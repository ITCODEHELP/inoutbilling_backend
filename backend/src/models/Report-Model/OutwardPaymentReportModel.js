const OutwardPayment = require('../../models/Payment-Model/OutwardPayment');
const mongoose = require('mongoose');

class OutwardPaymentReportModel {
    /**
     * Build dynamic MongoDB aggregation pipeline for Outward Payment Report
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Sorting and Pagination options
     * @returns {Array} MongoDB aggregation pipeline
     */
    static buildOutwardPaymentPipeline(filters = {}, options = {}) {
        const {
            fromDate,
            toDate,
            paymentType,
            customerVendor,
            staffId,
            selectedColumns = []
        } = filters;

        const {
            page = 1,
            limit = 50,
            sortBy = 'paymentDate',
            sortOrder = 'desc'
        } = options;

        const pipeline = [];
        const matchStage = {};

        // 1. User Security Filter
        if (filters.userId) {
            // Safely handle both String and ObjectId
            matchStage.userId = new mongoose.Types.ObjectId(String(filters.userId));
        }

        // 2. Date Range Filter
        if (fromDate || toDate) {
            matchStage.paymentDate = {};
            if (fromDate) {
                matchStage.paymentDate.$gte = new Date(fromDate);
            }
            if (toDate) {
                const endOfDay = new Date(toDate);
                endOfDay.setHours(23, 59, 59, 999);
                matchStage.paymentDate.$lte = endOfDay;
            }
        }

        // 3. Payment Type Filter
        if (paymentType && paymentType !== 'ALL') {
            const types = Array.isArray(paymentType) ? paymentType : [paymentType];
            // Filter out empty strings and check length
            const validTypes = types.filter(t => t && t.trim() !== '');

            if (validTypes.length > 0) {
                matchStage.paymentType = { $in: validTypes.map(t => t.toLowerCase()) };
            }
        }

        // 4. Customer/Vendor Name Filter (Particulars)
        if (customerVendor && customerVendor.trim() !== '') {
            matchStage.companyName = { $regex: customerVendor.trim(), $options: 'i' };
        }

        // 5. Staff Filter
        if (staffId && mongoose.Types.ObjectId.isValid(staffId)) {
            matchStage.staffId = new mongoose.Types.ObjectId(String(staffId));
        }

        // Apply Match Stage
        pipeline.push({ $match: matchStage });

        // 6. Project Stage (Dynamic Column Selection)
        const projectStage = this.buildProjectStage(selectedColumns);
        pipeline.push({ $project: projectStage });

        // 7. Sort Stage
        const sortStage = {};
        // Map UI sort fields to DB fields if necessary
        const sortFieldMap = {
            'Date': 'paymentDate',
            'Amount': 'amount',
            'Vch No': 'paymentNo'
        };
        const dbSortField = sortFieldMap[sortBy] || sortBy || 'paymentDate';
        sortStage[dbSortField] = sortOrder === 'asc' ? 1 : -1;
        pipeline.push({ $sort: sortStage });

        // 8. Pagination
        const skip = (page - 1) * limit;
        pipeline.push(
            { $skip: skip },
            { $limit: parseInt(limit) }
        );

        return pipeline;
    }

    /**
     * Build Projection Stage based on selected columns
     * Maps UI column names to DB fields
     */
    static buildProjectStage(selectedColumns) {
        // Default columns if none provided
        const defaults = [
            'Date', 'Particulars', 'Vch Type', 'Vch No', 'Amount'
        ];

        const columnsToProject = (selectedColumns && selectedColumns.length > 0)
            ? selectedColumns
            : defaults;

        const projection = { _id: 0 }; // Exclude _id from final output unless needed

        columnsToProject.forEach(col => {
            switch (col) {
                case 'Date':
                    projection['Date'] = {
                        $dateToString: { format: "%Y-%m-%d", date: "$paymentDate" }
                    };
                    break;
                case 'Particulars':
                    projection['Particulars'] = "$companyName";
                    break;
                case 'Payment Type':
                    projection['Payment Type'] = "$paymentType";
                    break;
                case 'Remarks':
                    projection['Remarks'] = { $ifNull: ["$remarks", ""] };
                    break;
                case 'Vch Type':
                    projection['Vch Type'] = { $literal: "Receipt" }; // As per image "Receipt" (or Payment?) Image says "Outward Payment" title but rows say "Receipt". 
                    // Usually Outward Payment = Payment Voucher. Inward = Receipt. 
                    // User Image shows "Vch Type: Receipt". This is strange for Outward Payment.
                    // However, I will stick to the requested "Payment" logical mapping or simple literal.
                    // Let's use "Payment" for Outward. If user specifically wants "Receipt", they can change.
                    // WAIT: Image shows "Receipt". Proceeding with "Receipt" to MATCH IMAGE exactly.
                    break;
                case 'Vch No':
                    projection['Vch No'] = "$paymentNo"; // Simplified, can concat prefix/postfix if needed
                    break;
                case 'Amount':
                    projection['Amount'] = "$amount";
                    break;
                case 'PAN NO':
                case 'GST NO':
                    projection[col] = { $ifNull: ["$gstinPan", ""] };
                    break;
                case 'Created By':
                    projection['Created By'] = { $literal: "" }; // Placeholder
                    break;
                case 'Attachment':
                    projection['Attachment'] = { $ifNull: ["$attachment", ""] };
                    break;
                default:
                    // Allow pass-through if field matches DB field
                    projection[col] = 1;
            }
        });

        return projection;
    }

    /**
     * Execute Report Generation
     */
    static async getOutwardPaymentReport(filters = {}, options = {}) {
        try {
            // Validate UserId
            if (!filters.userId || !mongoose.Types.ObjectId.isValid(filters.userId)) {
                return { success: false, message: 'Invalid User ID' };
            }

            const pipeline = this.buildOutwardPaymentPipeline(filters, options);


            // Count Pipeline (remove skip/limit)
            const countPipeline = pipeline.slice(0, -2);

            // Execute Aggregation
            const [results, countResult] = await Promise.all([
                OutwardPayment.aggregate(pipeline),
                OutwardPayment.aggregate([...countPipeline, { $count: 'total' }])
            ]);

            const totalRecords = countResult.length > 0 ? countResult[0].total : 0;
            const { page = 1, limit = 50 } = options;

            return {
                success: true,
                data: {
                    docs: results,
                    totalDocs: totalRecords,
                    limit: Number(limit),
                    totalPages: Math.ceil(totalRecords / limit),
                    page: Number(page)
                }
            };

        } catch (error) {
            console.error('Outward Payment Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            paymentTypes: [
                'cash', 'cheque', 'online', 'bank', 'tds',
                'bad_debit', 'currency_exchange_loss'
            ],
            columns: [
                'Date', 'Particulars', 'Payment Type', 'Remarks',
                'Vch Type', 'Vch No', 'Amount', 'PAN NO',
                'GST NO', 'Created By', 'Attachment'
            ],
            sortFields: ['Date', 'Amount', 'Vch No']
        };
    }
}

module.exports = OutwardPaymentReportModel;
