const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class SalesReportModel {
    /**
     * Build dynamic MongoDB aggregation pipeline for sales report
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Grouping and column options
     * @returns {Array} MongoDB aggregation pipeline
     */
    static buildSalesReportPipeline(filters = {}, options = {}) {
        const {
            customerVendor,
            products,
            productGroup,
            dateRange,
            staffName,
            invoiceNumber,
            invoiceSeries,
            serialNumber,
            includeCancelled = false,
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

        // Stage 1: Match stage for filtering
        const matchStage = {};

        // Add userId filter for data isolation (always required)
        if (filters.userId) {
            matchStage.userId = filters.userId;
        }

        // Customer/Vendor filter
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

        // Products filter
        if (products && products.length > 0) {
            matchStage['items.productName'] = { $in: products };
        }

        // Product Group filter
        if (productGroup && productGroup.length > 0) {
            matchStage['items.productGroup'] = { $in: productGroup };
        }

        // Date range filter
        if (dateRange && (dateRange.from || dateRange.to)) {
            const dateFilter = {};
            if (dateRange.from) {
                dateFilter.$gte = new Date(dateRange.from);
            }
            if (dateRange.to) {
                dateFilter.$lte = new Date(dateRange.to);
            }
            matchStage['invoiceDetails.date'] = dateFilter;
        }

        // Staff name filter - REMOVED: field not in schema
        // if (staffName) {
        //     matchStage['staff.name'] = { 
        //         $regex: staffName, 
        //         $options: 'i' 
        //     };
        // }

        // Invoice number filter
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

        // Serial number filter - REMOVED: field not in schema
        // if (serialNumber) {
        //     matchStage['serialNumber'] = { 
        //         $regex: serialNumber, 
        //         $options: 'i' 
        //     };
        // }

        // Include cancelled invoices - REMOVED: status field not in schema
        // if (!includeCancelled) {
        //     matchStage.status = { $ne: 'cancelled' };
        // }

        // Advanced dynamic filters
        if (advanceFilters && advanceFilters.length > 0) {
            advanceFilters.forEach(filter => {
                const { field, operator, value } = filter;
                const condition = this.buildAdvanceFilterCondition(field, operator, value);
                if (condition) {
                    Object.assign(matchStage, condition);
                }
            });
        }

        // Add match stage if there are conditions
        if (Object.keys(matchStage).length > 0) {
            pipeline.push({ $match: matchStage });
        }

        // Stage 2: Unwind items if product-level filtering or columns are needed
        const needsItemUnwind = this.needsItemLevelData(selectedColumns) ||
            products?.length > 0 ||
            productGroup?.length > 0;

        if (needsItemUnwind) {
            pipeline.push({ $unwind: '$items' });

            // Re-apply product filters after unwind if needed
            if (products && products.length > 0) {
                pipeline.push({
                    $match: { 'items.productName': { $in: products } }
                });
            }

            if (productGroup && productGroup.length > 0) {
                pipeline.push({
                    $match: { 'items.productGroup': { $in: productGroup } }
                });
            }
        }

        // Stage 3: Grouping stage
        const groupStage = this.buildGroupStage(groupByCustomer, groupByCurrency, needsItemUnwind);
        if (groupStage) {
            pipeline.push({ $group: groupStage });
        }

        // Stage 4: Project stage for column selection
        const projectStage = this.buildProjectStage(selectedColumns, needsItemUnwind, groupByCustomer || groupByCurrency);
        pipeline.push({ $project: projectStage });

        // Stage 5: Sorting
        const sortStage = {};
        sortStage[sortBy] = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: sortStage });

        // Stage 6: Pagination
        const skip = (page - 1) * limit;
        pipeline.push(
            { $skip: skip },
            { $limit: parseInt(limit) }
        );

        return pipeline;
    }

    /**
     * Build condition for advanced filters
     * @param {string} field - Field name
     * @param {string} operator - Operator type
     * @param {*} value - Filter value
     * @returns {Object} MongoDB condition
     */
    static buildAdvanceFilterCondition(field, operator, value) {
        // Whitelist of allowed fields for security
        const allowedFields = [
            'customerInformation.ms',
            'customerInformation.gstinPan',
            'customerInformation.address',
            'customerInformation.phone',
            'invoiceDetails.invoiceNumber',
            'invoiceDetails.invoicePrefix',
            'invoiceDetails.date',
            'invoiceDetails.invoiceType',
            'totals.grandTotal',
            'totals.totalTaxable',
            'totals.totalTax',
            'totals.totalCGST',
            'totals.totalSGST',
            'totals.totalIGST',
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
            'items.itemNote',
            'customerInformation.city',
            'customerInformation.state',
            'customerInformation.shipToName',
            'customerInformation.shipToState',
            'customerInformation.shipToCity',
            'invoiceDetails.vehicleNo',
            'invoiceDetails.lrNo',
            'invoiceDetails.ewayNo',
            'additionalNotes',
            'totals.otherTaxAmounts'
        ];

        // Validate field
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
            col.includes('product') ||
            col.includes('hsn') ||
            col.includes('qty') ||
            col.includes('price') ||
            col.includes('discount')
        );
    }

    /**
     * Build grouping stage
     * @param {boolean} groupByCustomer - Group by customer flag
     * @param {boolean} groupByCurrency - Group by currency flag
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @returns {Object|null}
     */
    static buildGroupStage(groupByCustomer, groupByCurrency, hasItemLevel) {
        if (!groupByCustomer && !groupByCurrency) {
            return null;
        }

        const groupStage = {};

        // Group by fields
        const groupFields = [];
        if (groupByCustomer) {
            groupFields.push('$customerInformation.ms');
        }
        // REMOVED: originalCurrency field not in schema
        // if (groupByCurrency) {
        //     groupFields.push('$originalCurrency');
        // }

        if (groupFields.length > 0) {
            groupStage._id = groupFields.length === 1 ? groupFields[0] : groupFields;
        } else {
            groupStage._id = null; // Group all documents together
        }

        // Add aggregations
        groupStage.totalInvoices = { $sum: 1 };
        groupStage.totalGrandTotal = { $sum: '$totals.grandTotal' };
        groupStage.totalTaxable = { $sum: '$totals.totalTaxable' };
        groupStage.totalTax = { $sum: '$totals.totalTax' };

        if (hasItemLevel) {
            groupStage.totalQuantity = { $sum: '$items.qty' };
            groupStage.totalItems = { $sum: '$items.total' };
        }

        // Push all invoice data for detailed view - FIXED: $$ROOT instead of $ROOT
        groupStage.invoices = { $push: '$$ROOT' };

        return groupStage;
    }

    /**
     * Build projection stage for column selection
     * @param {Array} selectedColumns - Selected columns
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @param {boolean} isGrouped - Whether data is grouped
     * @returns {Object}
     */
    static buildProjectStage(selectedColumns, hasItemLevel, isGrouped) {
        // Default columns if none selected
        if (!selectedColumns || selectedColumns.length === 0) {
            selectedColumns = this.getDefaultColumns(hasItemLevel);
        }

        const projectStage = { _id: 0 };

        if (isGrouped) {
            // For grouped data, include group fields and aggregations
            if (selectedColumns.includes('customerInformation.ms')) {
                projectStage.customer = '$_id.customerInformation.ms';
            }
            // REMOVED: originalCurrency field not in schema
            // if (selectedColumns.includes('originalCurrency')) {
            //     projectStage.currency = '$_id.originalCurrency';
            // }

            // Include aggregation results
            projectStage.totalInvoices = 1;
            projectStage.totalGrandTotal = 1;
            projectStage.totalTaxable = 1;
            projectStage.totalTax = 1;

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
                projection[col] = 1;
            } else if (col.startsWith('invoiceDetails.')) {
                projection[col] = 1;
            } else if (col.startsWith('totals.')) {
                projection[col] = 1;
            } else if (col.startsWith('items.') && hasItemLevel) {
                projection[col] = 1;
            } else if (col === 'paymentType') {
                projection.paymentType = 1;
            } else if (col === 'dueDate') {
                projection.dueDate = 1;
            } else if (col === 'bankDetails') {
                projection.bankDetails = 1;
            } else if (col === 'termsTitle') {
                projection.termsTitle = 1;
            } else if (col === 'termsDetails') {
                projection.termsDetails = 1;
            } else if (col === 'additionalNotes') {
                projection.additionalNotes = 1;
            } else if (col === 'documentRemarks') {
                projection.documentRemarks = 1;
            } else if (col === 'createdAt') {
                projection.createdAt = 1;
            } else if (col === 'updatedAt') {
                projection.updatedAt = 1;
            }
        });

        return projection;
    }

    /**
     * Get default columns for projection
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
            'totals.totalTaxable',
            'totals.totalTax',
            'paymentType',
            'createdAt'
        ];

        if (hasItemLevel) {
            defaultColumns.push(
                'items.productName',
                'items.hsnSac',
                'items.qty',
                'items.price',
                'items.total'
            );
        }

        return defaultColumns;
    }

    /**
     * Execute sales report query
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Query options
     * @returns {Promise<Object>} Query results with pagination
     */
    static async getSalesReport(filters = {}, options = {}) {
        try {
            // Add userId filter for data isolation
            if (filters.userId) {
                filters.userId = filters.userId;
            }

            const pipeline = this.buildSalesReportPipeline(filters, options);

            // Get count pipeline (without pagination)
            const countPipeline = pipeline.slice(0, -2); // Remove skip and limit

            // Execute both queries in parallel
            const [results, countResult] = await Promise.all([
                SaleInvoice.aggregate(pipeline),
                SaleInvoice.aggregate([...countPipeline, { $count: 'total' }])
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
            console.error('Sales Report Error:', error.message);
            return {
                success: false,
                message: 'Database query failed',
                error: error.message
            };
        }
    }

    /**
     * Get available filter fields and their metadata with dynamic values
     * @param {string} userId - User ID for data isolation
     * @returns {Promise<Object>} Available filters, columns, and dynamic data
     */
    static async getFilterMetadata(userId) {
        // Fetch dynamic lists for filters
        const [customers, products, productGroups, invoicePrefixes] = await Promise.all([
            SaleInvoice.distinct('customerInformation.ms', { userId }),
            SaleInvoice.distinct('items.productName', { userId }),
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
                products: {
                    label: 'Products',
                    type: 'array',
                    field: 'items.productName',
                    operators: ['equals', 'contains'],
                    options: products.sort()
                },
                productGroup: {
                    label: 'Product Group',
                    type: 'array',
                    field: 'items.productGroup',
                    operators: ['equals', 'contains'],
                    options: productGroups.sort()
                },
                invoiceSeries: {
                    label: 'Invoice Series',
                    type: 'string',
                    field: 'invoiceDetails.invoicePrefix',
                    operators: ['equals', 'contains'],
                    options: invoicePrefixes.sort()
                },
                dateRange: {
                    label: 'Date Range',
                    type: 'daterange',
                    field: 'invoiceDetails.date',
                    operators: ['between']
                },
                invoiceNumber: {
                    label: 'Invoice Number',
                    type: 'string',
                    field: 'invoiceDetails.invoiceNumber',
                    operators: ['equals', 'contains']
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
                    { field: 'invoiceDetails.deliveryMode', label: 'Delivery Mode' },
                    { field: 'dueDate', label: 'Due Date' },
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
            // For select dropdowns directly
            dynamicValues: {
                customers: customers.sort(),
                products: products.sort(),
                productGroups: productGroups.sort(),
                invoicePrefixes: invoicePrefixes.sort()
            }
        };
    }
}

module.exports = SalesReportModel;
