const OutwardPayment = require('../../models/Payment-Model/OutwardPayment');
const mongoose = require('mongoose');

class OutwardPaymentReportModel {
    /**
     * Generate Outward Payment Report based on filters and options
     */
    static async getOutwardPaymentReport(filters, options) {
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

            // ✅ REQUIRED FIX 1: Validate userId before ObjectId casting
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                throw new Error('Invalid or missing userId');
            }

            const query = {
                userId: new mongoose.Types.ObjectId(userId)
            };

            // ✅ REQUIRED FIX 2: Correct date range handling
            if (fromDate || toDate) {
                query.paymentDate = {};
                if (fromDate) {
                    query.paymentDate.$gte = new Date(fromDate);
                }
                if (toDate) {
                    const endOfDay = new Date(toDate);
                    endOfDay.setHours(23, 59, 59, 999);
                    query.paymentDate.$lte = endOfDay;
                }
            }

            // Payment Type Filter
            if (paymentType && paymentType !== 'ALL') {
                const types = Array.isArray(paymentType) ? paymentType : [paymentType];
                query.paymentType = { $in: types.map(t => t.toLowerCase()) };
            }

            // Vendor / Company Filter
            if (customerVendor) {
                query.companyName = { $regex: customerVendor, $options: 'i' };
            }

            // Staff Filter (safe cast)
            if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
                query.staffId = new mongoose.Types.ObjectId(staffId);
            }

            const skip = (page - 1) * limit;
            const sortOptions = {
                [sortBy]: sortOrder === 'asc' ? 1 : -1
            };

            const [data, total] = await Promise.all([
                OutwardPayment.find(query)
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                OutwardPayment.countDocuments(query)
            ]);

            // Transform for report output
            const reportData = data.map(record => {
                const row = {};

                const formatDate = d =>
                    d ? new Date(d).toISOString().split('T')[0] : '';

                const columns =
                    selectedColumns && selectedColumns.length > 0
                        ? selectedColumns
                        : OutwardPaymentReportModel.getFilterMetadata().columns;

                columns.forEach(col => {
                    switch (col) {
                        case 'Date':
                            row[col] = formatDate(record.paymentDate);
                            break;
                        case 'Particulars':
                            row[col] = record.companyName;
                            break;
                        case 'Payment Type':
                            row[col] = String(record.paymentType).toUpperCase();
                            break;
                        case 'Remarks':
                            row[col] = record.remarks || '';
                            break;
                        case 'Vch Type':
                            row[col] = 'Payment';
                            break;
                        case 'Vch No':
                            row[col] = `${record.paymentPrefix || ''}${record.paymentNo}${record.paymentPostfix || ''}`;
                            break;
                        case 'Amount':
                            row[col] = record.amount;
                            break;
                        case 'PAN NO':
                        case 'GST NO':
                            row[col] = record.gstinPan || '';
                            break;
                        case 'Created By':
                            row[col] = '';
                            break;
                        case 'Attachment':
                            row[col] = record.attachment || '';
                            break;
                        default:
                            row[col] = '';
                    }
                });

                return row;
            });

            return {
                success: true,
                data: {
                    docs: reportData,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page),
                    pagingCounter: (page - 1) * limit + 1,
                    hasPrevPage: page > 1,
                    hasNextPage: page < Math.ceil(total / limit),
                    prevPage: page > 1 ? page - 1 : null,
                    nextPage: page < Math.ceil(total / limit) ? page + 1 : null
                }
            };

        } catch (error) {
            console.error('Error in getOutwardPaymentReport:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    static getFilterMetadata() {
        return {
            paymentTypes: [
                'cash',
                'cheque',
                'online',
                'bank',
                'tds',
                'bad_debit',
                'currency_exchange_loss'
            ],
            columns: [
                'Date',
                'Particulars',
                'Payment Type',
                'Remarks',
                'Vch Type',
                'Vch No',
                'Amount',
                'PAN NO',
                'GST NO',
                'Created By',
                'Attachment'
            ],
            sortFields: ['paymentDate', 'amount', 'paymentNo']
        };
    }
}

module.exports = OutwardPaymentReportModel;
