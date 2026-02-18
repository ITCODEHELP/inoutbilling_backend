const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class SalesOutstandingReportModel {
    /**
     * Build optimized MongoDB aggregation pipeline for sales outstanding report
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Grouping and column options
     * @returns {Array} MongoDB aggregation pipeline
     */
    static buildOutstandingPipeline(filters = {}, options = {}) {
        const {
            customerVendor,
            productGroup,
            staffName,
            invoiceNumber,
            invoiceSeries,
            invoiceDateRange,
            dueDateRange,
            dueDaysRange,
            includePaid = false,
            groupByDueDays = false,
            groupByCustomer = false,
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

        // Stage 1: Match stage for filtering with optimized indexing
        const matchStage = {};

        // Add userId filter for data isolation (always required)
        if (filters.userId) {
            matchStage.userId = typeof filters.userId === 'string'
                ? new mongoose.Types.ObjectId(filters.userId)
                : filters.userId;
        }

        // Customer/Vendor filter - indexed field
        if (customerVendor) {
            const customersArr = typeof customerVendor === 'string'
                ? customerVendor.split(',').map(c => c.trim()).filter(Boolean)
                : [customerVendor];

            if (customersArr.length > 0) {
                matchStage['customerInformation.ms'] = {
                    $regex: customersArr.join('|'),
                    $options: 'i'
                };
            }
        }

        // Product Group filter - requires unwind
        if (productGroup && productGroup.length > 0) {
            matchStage['items.productGroup'] = { $in: productGroup };
        }

        // Invoice number filter - indexed field
        if (invoiceNumber) {
            matchStage['invoiceDetails.invoiceNumber'] = {
                $regex: invoiceNumber,
                $options: 'i'
            };
        }

        // Invoice series/prefix filter
        if (invoiceSeries) {
            matchStage['invoiceDetails.invoicePrefix'] = {
                $regex: invoiceSeries,
                $options: 'i'
            };
        }

        // Staff name filter
        if (staffName) {
            matchStage['invoiceDetails.createdBy'] = {
                $regex: staffName,
                $options: 'i'
            };
        }

        // Due date range filter - indexed field
        if (dueDateRange && (dueDateRange.from || dueDateRange.to)) {
            const dateFilter = {};
            if (dueDateRange.from) dateFilter.$gte = new Date(dueDateRange.from);
            if (dueDateRange.to) dateFilter.$lte = new Date(dueDateRange.to);
            matchStage.dueDate = dateFilter;
        }

        // Invoice date range filter - indexed field
        if (invoiceDateRange && (invoiceDateRange.from || invoiceDateRange.to)) {
            const dateFilter = {};
            if (invoiceDateRange.from) dateFilter.$gte = new Date(invoiceDateRange.from);
            if (invoiceDateRange.to) dateFilter.$lte = new Date(invoiceDateRange.to);
            matchStage['invoiceDetails.date'] = dateFilter;
        }

        // Initial match stage is for DB-indexed fields only.
        // We will filter by outstandingAmount > 0 in the calculated stage below.

        // Advanced dynamic filters with field validation
        const calculatedFieldNames = ['daysOverdue', 'outstandingAmount', 'dueDaysCategory'];
        const dbFilters = [];
        const calculatedFilters = [];

        if (advanceFilters && advanceFilters.length > 0) {
            advanceFilters.forEach(filter => {
                const { field, operator, value } = filter;
                const condition = this.buildAdvanceFilterCondition(field, operator, value);
                if (condition) {
                    if (calculatedFieldNames.includes(field)) {
                        calculatedFilters.push(condition);
                    } else {
                        dbFilters.push(condition);
                    }
                }
            });
        }

        // Fix: If not including paid, also ensure outstandingAmount > 0
        if (!includePaid) {
            calculatedFilters.push({ outstandingAmount: { $gt: 0 } });
        }

        // Apply db-level advanced filters
        if (dbFilters.length > 0) {
            dbFilters.forEach(cond => Object.assign(matchStage, cond));
        }

        // Add match stage if there are conditions
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Stage 2: Unwind items if product-level filtering or columns are needed
        const needsItemUnwind = this.needsItemLevelData(selectedColumns) ||
            productGroup?.length > 0;

        if (needsItemUnwind) {
            pipeline.push({ $unwind: '$items' });

            // Re-apply product filters after unwind if needed
            if (productGroup && productGroup.length > 0) {
                pipeline.push({
                    $match: { 'items.productGroup': { $in: productGroup } }
                });
            }
        }

        // Stage 3: Calculate outstanding fields (optimized for performance)
        pipeline.push({
            $addFields: {
                // Calculate days overdue
                daysOverdue: {
                    $divide: [
                        { $subtract: [new Date(), '$dueDate'] },
                        1000 * 60 * 60 * 24 // Convert to days
                    ]
                },
                // Calculate outstanding amount using paidAmount from schema
                outstandingAmount: {
                    $max: [
                        0,
                        { $subtract: [{ $ifNull: ['$totals.grandTotal', 0] }, { $ifNull: ['$paidAmount', 0] }] }
                    ]
                },
                // Due days category for grouping
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

        // Apply calculated-level advanced filters
        if (calculatedFilters.length > 0) {
            const calculatedMatch = {};
            calculatedFilters.forEach(cond => Object.assign(calculatedMatch, cond));
            pipeline.push({ $match: calculatedMatch });
        }

        // Stage 4: Filter by due days range if specified
        if (dueDaysRange && (dueDaysRange.from !== undefined || dueDaysRange.to !== undefined)) {
            const dueDaysFilter = {};
            if (dueDaysRange.from !== undefined) {
                dueDaysFilter.$gte = dueDaysRange.from;
            }
            if (dueDaysRange.to !== undefined) {
                dueDaysFilter.$lte = dueDaysRange.to;
            }
            pipeline.push({ $match: { daysOverdue: dueDaysFilter } });
        }

        // Stage 5: Grouping stage
        const groupStage = this.buildGroupStage(groupByDueDays, groupByCustomer, groupByCurrency, needsItemUnwind);
        if (groupStage) {
            pipeline.push({ $group: groupStage });
        }

        // Stage 6: Project stage for column selection (lean projection)
        const projectStage = this.buildProjectStage(selectedColumns, needsItemUnwind, groupByDueDays || groupByCustomer || groupByCurrency);
        pipeline.push({ $project: projectStage });

        // Stage 7: Sorting (index-friendly)
        const sortStage = {};
        sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: sortStage });

        // Stage 8: Pagination (cursor-based ready)
        const skip = (page - 1) * limit;
        pipeline.push(
            { $skip: skip },
            { $limit: parseInt(limit) }
        );

        return pipeline;
    }

    /**
     * Build condition for advanced filters with security validation
     * @param {string} field - Field name
     * @param {string} operator - Operator type
     * @param {*} value - Filter value
     * @returns {Object} MongoDB condition
     */
    static buildAdvanceFilterCondition(field, operator, value) {
        // Whitelist of allowed fields for security and performance
        const allowedFields = [
            'customerInformation.ms',
            'customerInformation.gstinPan',
            'customerInformation.phone',
            'invoiceDetails.invoiceNumber',
            'invoiceDetails.invoicePrefix',
            'invoiceDetails.date',
            'invoiceDetails.invoiceType',
            'totals.grandTotal',
            'totals.totalTaxable',
            'totals.totalTax',
            'paymentType',
            'dueDate',
            'createdAt',
            'updatedAt',
            'items.productName',
            'items.hsnSac',
            'items.productGroup',
            'items.qty',
            'items.price',
            'items.total',
            'customerInformation.city',
            'customerInformation.state',
            'customerInformation.shipToName',
            'customerInformation.shipToState',
            'customerInformation.shipToCity',
            'invoiceDetails.vehicleNo',
            'invoiceDetails.lrNo',
            'invoiceDetails.ewayNo',
            'items.itemNote',
            'additionalNotes',
            'totals.otherTaxAmounts',
            'daysOverdue',
            'outstandingAmount',
            'dueDaysCategory'
        ];

        // Validate field for security and index usage
        if (!allowedFields.includes(field)) {
            console.warn('WARNING: Advanced filter field not allowed:', field);
            return null;
        }

        const condition = {};

        switch (operator) {
            case 'equals':
                condition[field] = value;
                break;
            case 'notEquals':
                condition[field] = { $ne: value };
                break;
            case 'contains':
                condition[field] = { $regex: value, $options: 'i' };
                break;
            case 'greaterThan':
                condition[field] = { $gt: value };
                break;
            case 'greaterThanEquals':
                condition[field] = { $gte: value };
                break;
            case 'lessThan':
                condition[field] = { $lt: value };
                break;
            case 'lessThanEquals':
                condition[field] = { $lte: value };
                break;
            case 'blank':
                condition[field] = { $in: [null, '', undefined] };
                break;
            case 'between':
                if (Array.isArray(value) && value.length === 2) {
                    condition[field] = { $gte: value[0], $lte: value[1] };
                } else {
                    console.warn('WARNING: Between operator requires array with 2 values');
                    return null;
                }
                break;
            default:
                console.warn('WARNING: Invalid operator:', operator);
                return null;
        }

        return Object.keys(condition).length > 0 ? condition : null;
    }

    /**
     * Check if item-level data is needed
     * @param {Array} selectedColumns - Selected columns
     * @returns {boolean}
     */
    static needsItemLevelData(selectedColumns) {
        if (!selectedColumns || selectedColumns.length === 0) {
            return false;
        }

        return selectedColumns.some(col =>
            col.startsWith('items.') ||
            ['productName', 'hsnSac', 'productGroup', 'qty', 'price', 'discount', 'total'].some(key => col.includes(`items.${key}`))
        );
    }

    /**
     * Build grouping stage for outstanding report
     * @param {boolean} groupByDueDays - Group by due days flag
     * @param {boolean} groupByCustomer - Group by customer flag
     * @param {boolean} groupByCurrency - Group by currency flag
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @returns {Object|null}
     */
    static buildGroupStage(groupByDueDays, groupByCustomer, groupByCurrency, hasItemLevel) {
        if (!groupByDueDays && !groupByCustomer && !groupByCurrency) {
            return null;
        }

        const groupStage = {};

        // Group by fields
        const groupFields = [];
        if (groupByDueDays) {
            groupFields.push('$dueDaysCategory');
        }
        if (groupByCustomer) {
            groupFields.push('$customerInformation.ms');
        }
        if (groupByCurrency) {
            groupFields.push('$originalCurrency');
        }

        if (groupFields.length > 0) {
            groupStage._id = groupFields.length === 1 ? groupFields[0] : groupFields;
        } else {
            groupStage._id = null;
        }

        // Add aggregations for outstanding report
        groupStage.totalInvoices = { $sum: 1 };
        groupStage.totalGrandTotal = { $sum: '$totals.grandTotal' };
        groupStage.totalOutstanding = { $sum: '$outstandingAmount' };
        groupStage.avgDaysOverdue = { $avg: '$daysOverdue' };
        groupStage.maxDaysOverdue = { $max: '$daysOverdue' };

        if (hasItemLevel) {
            groupStage.totalQuantity = { $sum: '$items.qty' };
            groupStage.totalItems = { $sum: '$items.total' };
        }

        // Push all invoice data for detailed view
        groupStage.invoices = { $push: '$$ROOT' };

        return groupStage;
    }

    /**
     * Build projection stage for column selection (optimized for performance)
     * @param {Array} selectedColumns - Selected columns
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @param {boolean} isGrouped - Whether data is grouped
     * @returns {Object}
     */
    static buildProjectStage(selectedColumns, hasItemLevel, isGrouped) {
        // Default columns if none selected (optimized set)
        if (!selectedColumns || selectedColumns.length === 0) {
            selectedColumns = this.getDefaultColumns(hasItemLevel);
        }

        const projectStage = { _id: 0 };

        if (isGrouped) {
            // For grouped data, include group fields and aggregations
            if (selectedColumns.includes('customerInformation.ms')) {
                projectStage.customer = '$_id.customerInformation.ms';
            }
            if (selectedColumns.includes('dueDaysCategory')) {
                projectStage.dueDaysCategory = '$_id.dueDaysCategory';
            }

            // Include aggregation results
            projectStage.totalInvoices = 1;
            projectStage.totalGrandTotal = 1;
            projectStage.totalOutstanding = 1;
            projectStage.avgDaysOverdue = 1;
            projectStage.maxDaysOverdue = 1;

            if (hasItemLevel) {
                projectStage.totalQuantity = 1;
                projectStage.totalItems = 1;
            }

            // Include invoice details if requested
            if (selectedColumns.some(col => !col.includes('total'))) {
                projectStage.invoices = {
                    $map: {
                        input: '$invoices',
                        as: 'invoice',
                        in: this.buildInvoiceProjection(selectedColumns, hasItemLevel)
                    }
                };
            }
        } else {
            // For non-grouped data, project selected fields
            Object.assign(projectStage, this.buildInvoiceProjection(selectedColumns, hasItemLevel));
        }

        return projectStage;
    }

    /**
     * Build invoice projection based on selected columns
     * @param {Array} selectedColumns - Selected columns
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @returns {Object}
     */
    static buildInvoiceProjection(selectedColumns, hasItemLevel) {
        const projection = {};

        selectedColumns.forEach(col => {
            if (col.startsWith('customerInformation.')) {
                // Handle nested customerInformation fields
                const field = col.split('.')[1];
                if (!projection.customerInformation) {
                    projection.customerInformation = {};
                }
                projection.customerInformation[field] = 1;
            } else if (col.startsWith('invoiceDetails.')) {
                // Handle nested invoiceDetails fields
                const field = col.split('.')[1];
                if (!projection.invoiceDetails) {
                    projection.invoiceDetails = {};
                }
                projection.invoiceDetails[field] = 1;
            } else if (col.startsWith('totals.')) {
                // Handle nested totals fields
                const field = col.split('.')[1];
                if (!projection.totals) {
                    projection.totals = {};
                }
                projection.totals[field] = 1;
            } else if (col.startsWith('items.') && hasItemLevel) {
                // Handle nested items fields
                const field = col.split('.')[1];
                if (!projection.items) {
                    projection.items = {};
                }
                projection.items[field] = 1;
            } else if (col === 'paymentType') {
                projection.paymentType = 1;
            } else if (col === 'dueDate') {
                projection.dueDate = 1;
            } else if (col === 'daysOverdue') {
                projection.daysOverdue = 1;
            } else if (col === 'outstandingAmount') {
                projection.outstandingAmount = 1;
            } else if (col === 'dueDaysCategory') {
                projection.dueDaysCategory = 1;
            } else if (col === 'createdAt') {
                projection.createdAt = 1;
            } else if (col === 'updatedAt') {
                projection.updatedAt = 1;
            }
        });

        // Always include essential fields for payment reminders
        if (!projection.customerInformation) projection.customerInformation = {};
        projection.customerInformation.phone = 1;
        projection.customerInformation.email = 1;
        projection.customerInformation.ms = 1;

        if (!projection.invoiceDetails) projection.invoiceDetails = {};
        projection.invoiceDetails.invoiceNumber = 1;

        if (!projection.totals) projection.totals = {};
        projection.totals.grandTotal = 1;

        projection.dueDate = 1;

        return projection;
    }

    /**
     * Get default columns for projection (optimized for performance)
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @returns {Array}
     */
    static getDefaultColumns(hasItemLevel) {
        const defaultColumns = [
            'customerInformation.ms',
            'customerInformation.gstinPan',
            'invoiceDetails.invoiceNumber',
            'invoiceDetails.date',
            'invoiceDetails.invoiceType',
            'totals.grandTotal',
            'dueDate',
            'daysOverdue',
            'outstandingAmount',
            'dueDaysCategory',
            'paymentType',
            'createdAt'
        ];

        if (hasItemLevel) {
            defaultColumns.push(
                'items.productName',
                'items.hsnSac',
                'items.productGroup',
                'items.qty',
                'items.price',
                'items.total'
            );
        }

        return defaultColumns;
    }

    /**
     * Execute sales outstanding report query with performance optimizations
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Query results with pagination
     */
    static async getSalesOutstandingReport(filters = {}, options = {}) {
        try {
            const pipeline = this.buildOutstandingPipeline(filters, options);

            // Get count pipeline (without pagination for performance)
            const countPipeline = pipeline.slice(0, -2); // Remove skip and limit

            // Execute both queries in parallel for performance
            const [results, countResult] = await Promise.all([
                SaleInvoice.aggregate(pipeline).allowDiskUse(true), // Allow disk use for large datasets
                SaleInvoice.aggregate([...countPipeline, { $count: 'total' }]).allowDiskUse(true)
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
            console.error('Sales Outstanding Report Error:', error.message);
            return {
                success: false,
                message: 'Database query failed',
                error: error.message
            };
        }
    }

    /**
     * Get outstanding report statistics for dashboard
     * @param {Object} filters - Filter criteria
     * @returns {Promise<Object>} Outstanding statistics
     */
    static async getOutstandingStatistics(filters = {}) {
        try {
            const basePipeline = this.buildOutstandingPipeline(filters, {});

            // Remove pagination and projection for statistics
            const statsPipeline = basePipeline.slice(0, -3);

            // Add statistics aggregation
            statsPipeline.push({
                $group: {
                    _id: null,
                    totalInvoices: { $sum: 1 },
                    totalGrandTotal: { $sum: '$totals.grandTotal' },
                    totalOutstanding: { $sum: '$outstandingAmount' },
                    avgDaysOverdue: { $avg: '$daysOverdue' },
                    criticalOverdue: {
                        $sum: {
                            $cond: [{ $gte: ['$daysOverdue', 90] }, 1, 0]
                        }
                    },
                    overdueInvoices: {
                        $sum: {
                            $cond: [{ $gt: ['$daysOverdue', 0] }, 1, 0]
                        }
                    }
                }
            });

            const result = await SaleInvoice.aggregate(statsPipeline).allowDiskUse(true);

            return {
                success: true,
                data: result.length > 0 ? result[0] : {
                    totalInvoices: 0,
                    totalGrandTotal: 0,
                    totalOutstanding: 0,
                    avgDaysOverdue: 0,
                    criticalOverdue: 0,
                    overdueInvoices: 0
                },
                message: 'Outstanding statistics retrieved successfully'
            };
        } catch (error) {
            console.error('Outstanding Statistics Error:', error.message);
            return {
                success: false,
                message: 'Statistics query failed',
                error: error.message
            };
        }
    }

    /**
     * Get available filter fields and their metadata for outstanding report with dynamic values
     * @param {string} userId - User ID for data isolation
     * @returns {Promise<Object>} Available filters, columns, and dynamic data
     */
    static async getFilterMetadata(userId) {
        // Fetch dynamic lists for filters
        const [customers, productGroups, invoicePrefixes] = await Promise.all([
            SaleInvoice.distinct('customerInformation.ms', { userId }),
            SaleInvoice.distinct('items.productGroup', { userId }),
            SaleInvoice.distinct('invoiceDetails.invoicePrefix', { userId })
        ]);

        return {
            filterFields: {
                customerVendor: {
                    label: 'Customer/Vendor',
                    type: 'string',
                    field: 'customerInformation.ms',
                    operators: ['equals', 'contains'],
                    options: customers.sort()
                },
                productGroup: {
                    label: 'Product Group',
                    type: 'array',
                    field: 'items.productGroup',
                    operators: ['equals', 'contains'],
                    options: productGroups.sort()
                },
                invoiceNumber: {
                    label: 'Invoice Number',
                    type: 'string',
                    field: 'invoiceDetails.invoiceNumber',
                    operators: ['equals', 'contains']
                },
                invoiceSeries: {
                    label: 'Invoice Series',
                    type: 'string',
                    field: 'invoiceDetails.invoicePrefix',
                    operators: ['equals', 'contains'],
                    options: invoicePrefixes.sort()
                },
                dueDateRange: {
                    label: 'Due Date Range',
                    type: 'daterange',
                    field: 'dueDate',
                    operators: ['between']
                },
                dueDaysRange: {
                    label: 'Due Days Range',
                    type: 'numberrange',
                    field: 'daysOverdue',
                    operators: ['between']
                },
                includePaid: {
                    label: 'Include Paid Invoices',
                    type: 'boolean',
                    field: 'outstandingAmount',
                    operators: ['equals']
                }
            },
            availableColumns: {
                invoiceLevel: [
                    { field: 'customerInformation.ms', label: 'Customer Name' },
                    { field: 'customerInformation.gstinPan', label: 'GSTIN' },
                    { field: 'customerInformation.address', label: 'Billing Address' },
                    { field: 'customerInformation.shipTo', label: 'Shipping Address' },
                    { field: 'customerInformation.contactPerson', label: 'Contact Person' },
                    { field: 'customerInformation.phone', label: 'Phone' },
                    { field: 'invoiceDetails.invoiceNumber', label: 'Invoice Number' },
                    { field: 'invoiceDetails.invoicePrefix', label: 'Invoice Prefix' },
                    { field: 'invoiceDetails.date', label: 'Invoice Date' },
                    { field: 'invoiceDetails.invoiceType', label: 'Invoice Type' },
                    { field: 'dueDate', label: 'Due Date' },
                    { field: 'daysOverdue', label: 'Days Overdue' },
                    { field: 'outstandingAmount', label: 'Outstanding Amount' },
                    { field: 'dueDaysCategory', label: 'Due Days Category' },
                    { field: 'paymentType', label: 'Payment Type' },
                    { field: 'bankDetails', label: 'Bank Details' },
                    { field: 'termsTitle', label: 'Terms Title' },
                    { field: 'termsDetails', label: 'Terms Details' },
                    { field: 'additionalNotes', label: 'Additional Notes' },
                    { field: 'documentRemarks', label: 'Remarks' },
                    { field: 'totals.grandTotal', label: 'Grand Total' },
                    { field: 'totals.totalTaxable', label: 'Total Taxable' },
                    { field: 'totals.totalTax', label: 'Total Tax' },
                    { field: 'totals.totalCGST', label: 'Total CGST' },
                    { field: 'totals.totalSGST', label: 'Total SGST' },
                    { field: 'totals.totalIGST', label: 'Total IGST' },
                    { field: 'totals.roundOff', label: 'Round Off' },
                    { field: 'totals.totalInvoiceValue', label: 'Total Invoice Value' }
                ],
                itemLevel: [
                    { field: 'items.productName', label: 'Product Name' },
                    { field: 'items.hsnSac', label: 'Product HSN' },
                    { field: 'items.productGroup', label: 'Product Group' },
                    { field: 'items.qty', label: 'Quantity' },
                    { field: 'items.uom', label: 'UOM' },
                    { field: 'items.price', label: 'Price' },
                    { field: 'items.discount', label: 'Discount' },
                    { field: 'items.igst', label: 'IGST' },
                    { field: 'items.cgst', label: 'CGST' },
                    { field: 'items.sgst', label: 'SGST' },
                    { field: 'items.total', label: 'Item Total' },
                    { field: 'items.itemNote', label: 'Item Note' }
                ]
            },
            advanceFilterOperators: [
                { value: 'equals', label: 'Equals' },
                { value: 'notEquals', label: 'Not Equals' },
                { value: 'contains', label: 'Contains' },
                { value: 'greaterThan', label: 'Greater Than' },
                { value: 'lessThan', label: 'Less Than' },
                { value: 'between', label: 'Between' }
            ],
            groupingOptions: [
                { value: 'groupByDueDays', label: 'Group by Due Days' },
                { value: 'groupByCustomer', label: 'Group by Customer' },
                { value: 'groupByCurrency', label: 'Group by Currency' }
            ],
            dynamicValues: {
                customers: customers.sort(),
                productGroups: productGroups.sort(),
                invoicePrefixes: invoicePrefixes.sort()
            }
        };
    }
}

module.exports = SalesOutstandingReportModel;
