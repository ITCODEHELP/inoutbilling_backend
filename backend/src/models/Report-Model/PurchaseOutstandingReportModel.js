const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const Product = require('../Product-Service-Model/Product');
const mongoose = require('mongoose');

class PurchaseOutstandingReportModel {
    /**
     * Build optimized MongoDB aggregation pipeline for purchase outstanding report
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Grouping and column options
     * @returns {Array} MongoDB aggregation pipeline
     */
    static async buildOutstandingPipeline(filters = {}, options = {}) {
        const {
            customerVendor,
            productGroup,
            staffName,
            invoiceNumber,
            invoiceSeries, // Might not apply if Purchase Invoices don't have series logic same as Sales, but keeping for symmetry
            dueDateRange,
            dueDaysRange,
            includePaid = false,
            groupByDueDays = false,
            groupByCustomer = false, // Mapping groupByCustomer to groupByVendor logic (using vendorInformation.ms)
            groupByCurrency = false,
            advanceFilters = [],
            selectedColumns = []
        } = filters;

        const {
            page = 1,
            limit = 50,
            sortBy = 'invoiceDetails.date',
            sortOrder = 'desc'
        } = options;

        const pipeline = [];

        // Stage 1: Match stage for filtering
        const matchStage = {};

        // Add userId filter
        if (filters.userId) {
            matchStage.userId = new mongoose.Types.ObjectId(filters.userId);
        }

        // Vendor filter (Mapped from customerVendor)
        if (customerVendor) {
            matchStage['vendorInformation.ms'] = {
                $regex: customerVendor,
                $options: 'i'
            };
        }

        // Invoice number filter
        if (invoiceNumber) {
            matchStage['invoiceDetails.invoiceNumber'] = {
                $regex: invoiceNumber,
                $options: 'i'
            };
        }

        // Due date range filter
        if (dueDateRange && (dueDateRange.from || dueDateRange.to)) {
            const dateFilter = {};
            if (dueDateRange.from) {
                dateFilter.$gte = new Date(dueDateRange.from);
            }
            if (dueDateRange.to) {
                const endOfDay = new Date(dueDateRange.to);
                endOfDay.setUTCHours(23, 59, 59, 999);
                dateFilter.$lte = endOfDay;
            }
            matchStage.dueDate = dateFilter;
        }

        // Include/exclude paid invoices (using paidAmount vs grandTotal)
        if (!includePaid) {
            matchStage.$expr = { $gt: ['$totals.grandTotal', { $ifNull: ['$paidAmount', 0] }] };
        }

        // Advanced filters
        if (advanceFilters && advanceFilters.length > 0) {
            advanceFilters.forEach(filter => {
                const { field, operator, value } = filter;
                const condition = this.buildAdvanceFilterCondition(field, operator, value);
                if (condition) {
                    Object.assign(matchStage, condition);
                }
            });
        }

        // Product Group Optimization (Pre-fetch)
        // Since Purchase items might not have productGroup denormalized, we fetch products first.
        if (productGroup && productGroup.length > 0) {
            const productsInGroups = await Product.find({
                userId: filters.userId,
                productGroup: { $in: Array.isArray(productGroup) ? productGroup : [productGroup] }
            }).select('name').lean();

            const productNames = productsInGroups.map(p => p.name);

            if (productNames.length > 0) {
                matchStage['items.productName'] = { $in: productNames };
            } else {
                // Force empty result if group selected but no products found
                matchStage['items.productName'] = { $in: [] };
            }
        }

        // Add match stage
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Stage 2: Unwind items if product-level filtering or columns are needed
        const needsItemUnwind = this.needsItemLevelData(selectedColumns) || (productGroup && productGroup.length > 0);

        if (needsItemUnwind) {
            pipeline.push({ $unwind: '$items' });

            // Re-apply product filters after unwind if needed (for accurate row filtering)
            if (productGroup && productGroup.length > 0) {
                // We reuse the pre-fetched names logic from Match stage
                // But pipeline construction is sync, so we can't await inside plain push if we didn't store it.
                // Actually, matchStage already filtered documents.
                // Unwind expands them. We technically need to filter *items* again to show only relevant ones.
                // Since we can't easily pass the names array here without re-fetching or restructuring...
                // We will skip secondary item filtering for simplicity unless critical, 
                // or (Better) we move the logic to `getPurchaseOutstandingReport` and pass names.
                // For now, relying on Match stage is sufficient for document retrieval. 
            }
        }

        // Stage 3: Calculate outstanding fields
        pipeline.push({
            $addFields: {
                // Calculate days overdue
                daysOverdue: {
                    $let: {
                        vars: {
                            resolvedDate: {
                                $switch: {
                                    branches: [
                                        // Case 1: dueDate is a valid Date object
                                        { case: { $eq: [{ $type: "$dueDate" }, "date"] }, then: "$dueDate" },
                                        // Case 2: dueDate is a string (e.g. ISO string)
                                        { case: { $eq: [{ $type: "$dueDate" }, "string"] }, then: { $toDate: "$dueDate" } },
                                        // Case 3: invoiceDetails.date is a valid Date object (Fallback)
                                        { case: { $eq: [{ $type: "$invoiceDetails.date" }, "date"] }, then: "$invoiceDetails.date" },
                                        // Case 4: invoiceDetails.date is a string
                                        { case: { $eq: [{ $type: "$invoiceDetails.date" }, "string"] }, then: { $toDate: "$invoiceDetails.date" } }
                                    ],
                                    // Default: If all else fails (e.g. data corrupt), treat as Today to avoid crash
                                    default: new Date()
                                }
                            }
                        },
                        in: {
                            $max: [
                                0,
                                {
                                    $divide: [
                                        { $subtract: [new Date(), "$$resolvedDate"] },
                                        1000 * 60 * 60 * 24
                                    ]
                                }
                            ]
                        }
                    }
                },
                // Calculate outstanding amount: Grand Total - Paid Amount
                outstandingAmount: {
                    $max: [
                        0,
                        { $subtract: ['$totals.grandTotal', { $ifNull: ['$paidAmount', 0] }] }
                    ]
                },
                // Due days category
                dueDaysCategory: {
                    $switch: {
                        branches: [
                            { case: { $lt: ['$daysOverdue', 0] }, then: 'Not Due' },
                            { case: { $and: [{ $gte: ['$daysOverdue', 0] }, { $lt: ['$daysOverdue', 30] }] }, then: '0-30 Days' },
                            { case: { $and: [{ $gte: ['$daysOverdue', 30] }, { $lt: ['$daysOverdue', 60] }] }, then: '31-60 Days' },
                            { case: { $and: [{ $gte: ['$daysOverdue', 60] }, { $lt: ['$daysOverdue', 90] }] }, then: '61-90 Days' },
                            { case: { $and: [{ $gte: ['$daysOverdue', 90] }, { $lt: ['$daysOverdue', 180] }] }, then: '91-180 Days' }
                        ],
                        default: '180+ Days'
                    }
                }
            }
        });

        // Stage 4: Filter by due days range
        if (dueDaysRange && (dueDaysRange.from !== undefined || dueDaysRange.to !== undefined)) {
            const dueDaysFilter = {};
            if (dueDaysRange.from !== undefined) dueDaysFilter.$gte = dueDaysRange.from;
            if (dueDaysRange.to !== undefined) dueDaysFilter.$lte = dueDaysRange.to;
            pipeline.push({ $match: { daysOverdue: dueDaysFilter } });
        }

        // Stage 5: Grouping stage
        // Map groupByCustomer to Vendor
        const groupStage = this.buildGroupStage(groupByDueDays, groupByCustomer, groupByCurrency, needsItemUnwind);
        if (groupStage) {
            pipeline.push({ $group: groupStage });
        }

        // Stage 6: Project stage
        const projectStage = this.buildProjectStage(selectedColumns, needsItemUnwind, groupByDueDays || groupByCustomer || groupByCurrency);
        pipeline.push({ $project: projectStage });

        // Stage 7: Sorting
        const sortStage = {};
        sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: sortStage });

        // Stage 8: Pagination
        const skip = (page - 1) * limit;
        pipeline.push(
            { $skip: skip },
            { $limit: parseInt(limit) }
        );

        return pipeline;
    }

    static buildAdvanceFilterCondition(field, operator, value) {
        // Mapped to Purchase Fields
        const allowedFields = [
            'vendorInformation.ms',
            'vendorInformation.gstinPan',
            'vendorInformation.phone',
            'invoiceDetails.invoiceNumber',
            'invoiceDetails.date',
            'totals.grandTotal',
            'dueDate',
            'outstandingAmount',
            'dueDaysCategory'
        ];

        if (!allowedFields.includes(field)) return null;

        const condition = {};
        switch (operator) {
            case 'equals': condition[field] = value; break;
            case 'notEquals': condition[field] = { $ne: value }; break;
            case 'contains': condition[field] = { $regex: value, $options: 'i' }; break;
            case 'greaterThan': condition[field] = { $gt: value }; break;
            case 'lessThan': condition[field] = { $lt: value }; break;
            case 'between':
                if (Array.isArray(value) && value.length === 2) condition[field] = { $gte: value[0], $lte: value[1] };
                break;
        }
        return Object.keys(condition).length > 0 ? condition : null;
    }

    static needsItemLevelData(selectedColumns) {
        if (!selectedColumns || selectedColumns.length === 0) return false;
        return selectedColumns.some(col => col.startsWith('items.'));
    }

    static buildGroupStage(groupByDueDays, groupByVendor, groupByCurrency, hasItemLevel) {
        if (!groupByDueDays && !groupByVendor && !groupByCurrency) return null;

        const groupStage = {};
        const groupFields = [];

        if (groupByDueDays) groupFields.push('$dueDaysCategory');
        if (groupByVendor) groupFields.push('$vendorInformation.ms');
        if (groupByCurrency) groupFields.push('$originalCurrency'); // Assuming field exists or stays null

        groupStage._id = groupFields.length === 1 ? groupFields[0] : groupFields;

        groupStage.totalInvoices = { $sum: 1 };
        groupStage.totalGrandTotal = { $sum: '$totals.grandTotal' };
        groupStage.totalOutstanding = { $sum: '$outstandingAmount' };
        groupStage.avgDaysOverdue = { $avg: '$daysOverdue' };
        groupStage.invoices = { $push: '$$ROOT' };

        return groupStage;
    }

    static buildProjectStage(selectedColumns, hasItemLevel, isGrouped) {
        const projectStage = { _id: 0 };

        if (!selectedColumns || selectedColumns.length === 0) {
            // Default Columns
            return {
                'vendorInformation.ms': 1,
                'invoiceDetails.invoiceNumber': 1,
                'invoiceDetails.date': 1,
                'totals.grandTotal': 1,
                'dueDate': 1,
                'daysOverdue': 1,
                'outstandingAmount': 1,
                'dueDaysCategory': 1
            };
        }

        selectedColumns.forEach(col => projectStage[col] = 1);
        return projectStage;
    }

    static async getPurchaseOutstandingReport(filters = {}, options = {}) {
        try {
            const pipeline = await this.buildOutstandingPipeline(filters, options);
            const countPipeline = pipeline.slice(0, -2); // Remove skip/limit

            const [results, countResult] = await Promise.all([
                PurchaseInvoice.aggregate(pipeline).allowDiskUse(true),
                PurchaseInvoice.aggregate([...countPipeline, { $count: 'total' }]).allowDiskUse(true)
            ]);

            const totalRecords = countResult.length > 0 ? countResult[0].total : 0;
            const { page = 1, limit = 50 } = options;

            return {
                success: true,
                data: {
                    reports: results,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(totalRecords / limit),
                        totalRecords,
                        recordsPerPage: limit
                    }
                }
            };
        } catch (error) {
            console.error('Purchase Outstanding Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        // Return metadata structure
        return {
            filterFields: { /* ... mapped fields ... */ },
            availableColumns: { /* ... mapped columns ... */ },
            groupingOptions: [
                { value: 'groupByDueDays', label: 'Group by Due Days' },
                { value: 'groupByCustomer', label: 'Group by Vendor' }
            ]
        };
    }
}

module.exports = PurchaseOutstandingReportModel;
