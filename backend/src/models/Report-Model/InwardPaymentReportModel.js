const InwardPayment = require('../Payment-Model/InwardPayment');
const mongoose = require('mongoose');

class InwardPaymentReportModel {
    /**
     * Generate Inward Payment Report
     */
    static async getInwardPaymentReport(filters, options) {
        try {
            const {
                userId,
                customerVendor,
                paymentType,
                fromDate,
                toDate,
                staffId,
                selectedColumns
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'paymentDate',
                sortOrder = 'desc'
            } = options;

            const query = { userId: new mongoose.Types.ObjectId(userId) };

            // FIX: Date Range (Handle End of Day for toDate)
            if (fromDate || toDate) {
                query.paymentDate = {};
                if (fromDate) {
                    query.paymentDate.$gte = new Date(fromDate);
                }
                if (toDate) {
                    const endDate = new Date(toDate);
                    endDate.setHours(23, 59, 59, 999); // Set to end of day
                    query.paymentDate.$lte = endDate;
                }
            }

            // FIX: Payment Type (Case Insensitive)
            if (paymentType && paymentType !== 'ALL') {
                const types = Array.isArray(paymentType) ? paymentType : [paymentType];
                // Use regex for case insensitive match for each type
                const regexConditions = types.map(t => new RegExp(`^${t}$`, 'i'));
                query.paymentType = { $in: regexConditions };
            }

            // Customer/Vendor Filter
            if (customerVendor) {
                query.companyName = { $regex: customerVendor, $options: 'i' };
            }

            // Staff Filter
            if (staffId) {
                if (mongoose.Types.ObjectId.isValid(staffId)) {
                    query.staffId = new mongoose.Types.ObjectId(staffId);
                } else {
                    query.staffId = staffId;
                }
            }

            // DB Fields to fetch
            const dbFields = new Set(['_id', 'userId', 'receiptPrefix', 'receiptNo', 'receiptPostfix', 'paymentDate', 'companyName', 'paymentType', 'amount', 'remarks', 'gstinPan']);

            const skip = (page - 1) * limit;
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            // Calculate Total Amount (Aggregation)
            const totalPipeline = [
                { $match: query },
                { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
            ];

            const [data, total, totalResult] = await Promise.all([
                InwardPayment.find(query)
                    .select(Array.from(dbFields).join(' '))
                    .populate('userId', 'name')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                InwardPayment.countDocuments(query),
                InwardPayment.aggregate(totalPipeline)
            ]);

            const totalAmount = totalResult.length > 0 ? totalResult[0].totalAmount : 0;

            // Map to Report Structure
            const defaultColumns = InwardPaymentReportModel.getFilterMetadata().columns;
            const columnsToMap = selectedColumns && selectedColumns.length > 0 ? selectedColumns : defaultColumns;

            const mappedData = data.map(record => {
                const row = {};

                columnsToMap.forEach(col => {
                    switch (col) {
                        case 'Date':
                            row[col] = record.paymentDate ? new Date(record.paymentDate).toISOString().split('T')[0] : '';
                            break;
                        case 'Particulars':
                            row[col] = record.companyName || '';
                            break;
                        case 'Payment Type':
                            row[col] = record.paymentType ? String(record.paymentType).toUpperCase() : '';
                            break;
                        case 'Remarks':
                            row[col] = record.remarks || '';
                            break;
                        case 'Vch Type':
                            row[col] = 'Receipt';
                            break;
                        case 'Vch No':
                            row[col] = `${record.receiptPrefix || ''}${record.receiptNo}${record.receiptPostfix || ''}`;
                            break;
                        case 'Amount':
                            row[col] = record.amount || 0;
                            break;
                        case 'Contact Person':
                            row[col] = '';
                            break;
                        case 'PAN NO':
                        case 'GST NO':
                            row[col] = record.gstinPan || '';
                            break;
                        case 'Created By':
                            row[col] = record.userId?.name || 'Unknown';
                            break;
                        default:
                            // Ignore unknown columns
                            break;
                    }
                });
                return row;
            });

            // Append Total Row if 'Amount' column matches or if no columns selected (default includes Amount)
            // But user said: "Total respects selectedColumns (if Amount not selected, do not show total)"
            const isAmountSelected = columnsToMap.includes('Amount');

            if (isAmountSelected) {
                const totalRow = {
                    isTotalRow: true,
                    // label: 'Total', // User didn't ask for label in Inward Payment part, but usually good practice. 
                    // User Example: { "isTotalRow": true, "Amount": totalAmount }
                    Amount: totalAmount
                };
                mappedData.push(totalRow);
            }

            return {
                success: true,
                data: {
                    docs: mappedData,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page)
                }
            };

        } catch (error) {
            console.error('Error in getInwardPaymentReport:', error);
            return { success: false, message: 'Failed to generate report', error: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            paymentTypes: ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss'],
            columns: [
                'Date', 'Particulars', 'Payment Type', 'Remarks',
                'Vch Type', 'Vch No', 'Amount', 'Contact Person',
                'PAN NO', 'GST NO', 'Created By'
            ],
            sortFields: ['paymentDate', 'amount', 'receiptNo']
        };
    }
}

module.exports = InwardPaymentReportModel;
