const InwardPayment = require('../Payment-Model/InwardPayment');
const mongoose = require('mongoose');

class InwardPaymentReportModel {
    /**
     * Generate Inward Payment Report based on filters and options
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Pagination and sorting options
     * @returns {Object} Report data with pagination info
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
                selectedColumns,
                invoiceSeries // Optional filter if applicable
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'paymentDate',
                sortOrder = 'desc'
            } = options;

            // 1. Build Query
            const query = { userId: new mongoose.Types.ObjectId(userId) };

            // Date Range Filter
            if (fromDate || toDate) {
                query.paymentDate = {};
                if (fromDate) query.paymentDate.$gte = new Date(fromDate);
                if (toDate) query.paymentDate.$lte = new Date(toDate);
            }

            // Payment Type Filter
            if (paymentType && paymentType !== 'ALL') {
                // Ensure array for $in operator
                const types = Array.isArray(paymentType) ? paymentType : [paymentType];
                // Map frontend display types to schema enum values
                // Schema Enum: ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss']
                const validTypes = types.map(t => t.toLowerCase().replace('bad_debts_kasar', 'bad_debit'));
                query.paymentType = { $in: validTypes };
            }

            // Customer/Vendor Filter (Search by Company Name)
            if (customerVendor) {
                // Using regex for case-insensitive partial match
                query.companyName = { $regex: customerVendor, $options: 'i' };
            }

            // Staff Filter
            if (staffId) {
                // Schema doesn't explicitly show staffId, but adding query as requested.
                // Ensuring ObjectId if it's an ID string
                if (mongoose.Types.ObjectId.isValid(staffId)) {
                    query.staffId = new mongoose.Types.ObjectId(staffId);
                } else {
                    query.staffId = staffId;
                }
            }

            // 2. Build Projection
            // Default fields needed for processing + requested columns
            // Always fetch lean data

            const fieldMapping = {
                'Date': 'paymentDate',
                'Particulars': 'companyName',
                'Payment Type': 'paymentType',
                'Remarks': 'remarks',
                'Vch Type': 'receiptPrefix', // Logic needed: VchType is mostly "Receipt" or derived
                'Vch No': 'receiptNo',
                'Amount': 'amount',
                'Contact Person': 'customFields.contactPerson', // Speculative mapping
                'PAN NO': 'gstinPan',
                'GST NO': 'gstinPan',
                'Created By': 'userId', // Needs population
                'Attachment': 'attachment'
            };

            const dbFields = new Set(['_id', 'userId', 'receiptPrefix', 'receiptNo', 'receiptPostfix', 'paymentDate', 'companyName', 'paymentType', 'amount', 'remarks', 'gstinPan', 'attachment']);

            // 3. Execution
            const skip = (page - 1) * limit;

            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

            // Using lean() for read-only performance
            const [data, total] = await Promise.all([
                InwardPayment.find(query)
                    .select(Array.from(dbFields).join(' '))
                    .populate('userId', 'name') // Minimal population for 'Created By'
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                InwardPayment.countDocuments(query)
            ]);

            // 4. Transform Data
            // Map DB results to the requested Report Columns structure
            const reportData = data.map(record => {
                const mappedRecord = {};

                // Helper to format Date
                const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '';

                // Helper for Vch Type
                const getVchType = (r) => 'Receipt'; // Inward Payment is Receipt

                // Default columns if none selected (or map all available)
                const columnsToMap = selectedColumns && selectedColumns.length > 0 ? selectedColumns : Object.keys(fieldMapping);

                columnsToMap.forEach(col => {
                    switch (col) {
                        case 'Date':
                            mappedRecord[col] = formatDate(record.paymentDate);
                            break;
                        case 'Particulars':
                            mappedRecord[col] = record.companyName;
                            break;
                        case 'Payment Type':
                            mappedRecord[col] = String(record.paymentType).toUpperCase();
                            break;
                        case 'Remarks':
                            mappedRecord[col] = record.remarks || '';
                            break;
                        case 'Vch Type':
                            mappedRecord[col] = getVchType(record);
                            break;
                        case 'Vch No':
                            mappedRecord[col] = `${record.receiptPrefix || ''}${record.receiptNo}${record.receiptPostfix || ''}`; // Combine prefix/postfix
                            break;
                        case 'Amount':
                            mappedRecord[col] = record.amount;
                            break;
                        case 'Contact Person':
                            mappedRecord[col] = ''; // Not available in standard schema
                            break;
                        case 'PAN NO':
                        case 'GST NO':
                            mappedRecord[col] = record.gstinPan || '';
                            break;
                        case 'Created By':
                            mappedRecord[col] = record.userId?.name || 'Unknown';
                            break;
                        default:
                            mappedRecord[col] = '';
                    }
                });

                return mappedRecord;
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
            console.error('Error in getInwardPaymentReport:', error);
            return {
                success: false,
                message: 'Failed to generate report',
                error: error.message
            };
        }
    }

    /**
     * Get Filter Metadata for UI
     */
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
