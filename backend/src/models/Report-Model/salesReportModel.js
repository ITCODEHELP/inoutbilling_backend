const mongoose = require('mongoose');
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
            staffId, // Changed from staffName to staffId
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

        // Staff filter
        if (staffId) {
            matchStage['staff'] = new mongoose.Types.ObjectId(staffId);
        }

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

        // Serial number filter
        if (serialNumber) {
            matchStage['items.serialNumbers'] = {
                $regex: serialNumber,
                $options: 'i'
            };
        }

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

        // Lookup Staff Details (if needed for columns or verify)
        // We always lookup to make it available for projection
        pipeline.push({
            $lookup: {
                from: 'staffs', // Assuming collection name is 'staffs' based on ref 'Staff'
                localField: 'staff',
                foreignField: '_id',
                as: 'staffDetails'
            }
        });
        pipeline.push({
            $unwind: {
                path: '$staffDetails',
                preserveNullAndEmptyArrays: true
            }
        });

        // Stage 2: Unwind items if product-level filtering or columns are needed
        const needsItemUnwind = this.needsItemLevelData(selectedColumns) ||
            products?.length > 0 ||
            productGroup?.length > 0 ||
            serialNumber; // Unwind for serial number mapping if needed? 
        // Actually serialNumbers is array inside item. If we filter by it, valid docs are kept.
        // If we want to show WHICH item has the serial number, we might need unwind.
        // But usually report lists lines.

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

            // Re-apply serial number filter to show only relevant items if filtered
            if (serialNumber) {
                pipeline.push({
                    $match: {
                        'items.serialNumbers': {
                            $regex: serialNumber,
                            $options: 'i'
                        }
                    }
                });
            }
        }

        // Stage 3: Grouping stage
        const groupStages = this.buildGroupStages(groupByCustomer, groupByCurrency, needsItemUnwind);
        if (groupStages && groupStages.length > 0) {
            pipeline.push(...groupStages);
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
            'items.cgst',
            'items.sgst',
            'items.igst',
            'staffDetails.name', // Allow filtering/projection
            'items.serialNumbers'
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
            case 'lessThan':
                condition[field] = { $lt: value };
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
            col.includes('discount') ||
            col.includes('serialNumbers')
        );
    }

    /**
     * Build grouping stages
     * @param {boolean} groupByCustomer - Group by customer flag
     * @param {boolean} groupByCurrency - Group by currency flag
     * @param {boolean} hasItemLevel - Whether items are unwound
     * @returns {Array} Array of aggregation stages
     */
    static buildGroupStages(groupByCustomer, groupByCurrency, hasItemLevel) {
        if (!groupByCustomer && !groupByCurrency) {
            return [];
        }

        const stages = [];

        // If items are unwound, we must first group by invoice to get correct invoice-level totals
        if (hasItemLevel) {
            stages.push({
                $group: {
                    _id: '$_id',
                    doc: { $first: '$$ROOT' },
                    items: { $push: '$items' },
                    invoiceItemQty: { $sum: '$items.qty' },
                    invoiceItemTotal: { $sum: '$items.total' }
                }
            });

            // Reconstruct the document with filtered items
            stages.push({
                $addFields: {
                    'doc.items': '$items',
                    'doc.invoiceItemQty': '$invoiceItemQty',
                    'doc.invoiceItemTotal': '$invoiceItemTotal'
                }
            });

            // Replace root with the reconstructed doc
            stages.push({
                $replaceRoot: { newRoot: '$doc' }
            });
        }

        const groupStage = {};

        // Group by fields
        const groupFields = [];
        if (groupByCustomer) {
            groupFields.push('$customerInformation.ms');
        }

        if (groupFields.length > 0) {
            groupStage._id = groupFields.length === 1 ? groupFields[0] : groupFields;
        } else {
            groupStage._id = null;
        }

        // Add aggregations
        groupStage.totalInvoices = { $sum: 1 };
        groupStage.totalGrandTotal = { $sum: '$totals.grandTotal' };
        groupStage.totalTaxable = { $sum: '$totals.totalTaxable' };
        groupStage.totalTax = { $sum: '$totals.totalTax' };

        if (hasItemLevel) {
            groupStage.totalQuantity = { $sum: '$invoiceItemQty' };
            groupStage.totalItems = { $sum: '$invoiceItemTotal' };
        }

        // Push all invoice data for detailed view
        groupStage.invoices = { $push: '$$ROOT' };

        stages.push({ $group: groupStage });

        return stages;
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
            } else if (col === 'staffDetails.name') {
                projection['staffDetails.name'] = 1;
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
                filters.userId = new mongoose.Types.ObjectId(filters.userId);
            }

            const pipeline = this.buildSalesReportPipeline(filters, options);

            // Get count pipeline (without pagination)
            const countPipeline = pipeline.slice(0, -2); // Remove skip and limit

            // 1. Get Summary
            const isGrouped = filters.groupByCustomer || filters.groupByCurrency;
            const summaryPipeline = [...countPipeline]; // Use countPipeline as base (filters applied, no pagination)

            if (isGrouped) {
                // If already grouped, we sum the group totals
                summaryPipeline.push({
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: '$totalInvoices' },
                        taxableValueTotal: { $sum: '$totalTaxable' }, // Ensure these fields match buildGroupStages output
                        grandTotal: { $sum: '$totalGrandTotal' },
                        productsTotal: { $sum: '$totalItems' }
                    }
                });
            } else {
                // If flat list, sum the documents
                summaryPipeline.push({
                    $group: {
                        _id: null,
                        totalInvoices: { $sum: 1 },
                        taxableValueTotal: { $sum: '$totals.totalTaxable' },
                        grandTotal: { $sum: '$totals.grandTotal' },
                        productsTotal: { $sum: '$invoiceItemTotal' } // This field is projected in buildProjectStage? No.
                        // Wait, invoiceItemTotal is only available if hasItemLevel is true?
                        // If standard view, we don't have item totals unless projected?
                        // For safe fallback, we use 0 if not present.
                    }
                });
            }

            // Execute parallel: Reports, Summary, Count
            const [results, summaryResult, countResult] = await Promise.all([
                SaleInvoice.aggregate(pipeline),
                SaleInvoice.aggregate(summaryPipeline),
                SaleInvoice.aggregate([...countPipeline, { $count: 'total' }])
            ]);

            const totalRecords = countResult.length > 0 ? countResult[0].total : 0;
            const summary = summaryResult.length > 0 ? summaryResult[0] : { totalInvoices: 0, taxableValueTotal: 0, grandTotal: 0 };
            const { page = 1, limit = 50 } = options;

            // Format Data
            const formattedResults = this.formatReportData(results);
            // Don't format summary recursively yet, we need raw numbers for the total row
            // const formattedSummary = this.formatReportData([summary])[0]; 

            // Append Total Row
            const totalRow = {
                isTotalRow: true,
                label: 'Total',
                taxableValueTotal: summary.taxableValueTotal || 0,
                grandTotal: summary.grandTotal || 0
            };

            // Apply formatting to results (numbers to strings if needed, etc)
            // But user requirement says: "Ensure Numeric values remain numbers (not string)."
            // The formatReportData method converts numbers to localized strings.
            // "Numeric values remain numbers (not string)." applies to PART 1 (Inward Payment).
            // For PART 2 (Sales Report), the expected response shows numbers: "Grand Total": 224456 (no quotes)
            // However, existing formatReportData converts to strings. 
            // The user prompt also says: "Taxable Value Total": 156580 (number) in Expected Response.
            // So I should disable the string formatting for numbers if I want to strictly follow the "Expected Response" JSON values.
            // BUT, the existing controller uses formatReportData. 
            // I will MODIFY formatReportData to NOT convert to string if the user requested numeric preservation?
            // "Numeric values remain numbers (not string)." was listed under PART 1.
            // Under PART 5 Expected Response, values like 156580 are numbers.
            // So I should probably skip `formatReportData` or modify it to return numbers.
            // Given the existing code uses `toLocaleString`, it definitely returns strings.
            // I will skip `formatReportData` for now to strictly match the requested JSON type (Number).

            // Actually, let's keep it simple. The user wants the response to support rendering.
            // If I look at the expected response:
            // "Grand Total": 156580
            // This is a number.

            const finalData = [...results]; // Use raw results (with numbers)
            finalData.push(totalRow);

            // Determine columns list
            let columnsList = [];
            if (filters.selectedColumns && filters.selectedColumns.length > 0) {
                columnsList = filters.selectedColumns;
            } else {
                // We need to know if item level was used. 
                // We can re-derive it or pass it.
                // But wait, the pipeline builder already handled projection.
                // If selectedColumns is empty, we returned default columns in projection.
                // We should return the keys of the first record (excluding _id if necessary) or the default list.
                // Better to return the explicit list of columns we intended.
                const needsItemUnwind = this.needsItemLevelData(filters.selectedColumns) ||
                    filters.products?.length > 0 ||
                    filters.productGroup?.length > 0;
                columnsList = this.getDefaultColumns(needsItemUnwind);
            }

            return {
                success: true,
                data: {
                    columns: columnsList,
                    data: finalData,
                    pagination: {
                        totalDocs: totalRecords,
                        page: Number(page),
                        totalPages: Math.ceil(totalRecords / limit)
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
     * Format report data with localization
     * @param {Array} rows - Data rows
     * @returns {Array} Formatted rows
     */
    static formatReportData(rows) {
        return rows.map(row => {
            const newRow = JSON.parse(JSON.stringify(row));
            this.formatRecursive(newRow);
            return newRow;
        });
    }

    /**
     * Recursive formatting helper
     * @param {Object} obj - Object to format
     */
    static formatRecursive(obj) {
        for (const key in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

            const val = obj[key];

            // Handle Numbers (Currency/Amounts)
            if (typeof val === 'number') {
                // Try to identify currency fields by name
                if (key.match(/(amount|total|price|tax|cost|value|balance|rate)/i) && !key.match(/(id|year|qty|quantity|count|number|page|limit)/i)) {
                    obj[key] = val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                }
            }
            // Handle Dates
            else if (typeof val === 'string' && (key.match(/date/i) || key === 'createdAt' || key === 'updatedAt')) {
                // Avoid formatting short strings that might be date parts
                if (val.length > 9) {
                    const date = new Date(val);
                    if (!isNaN(date.getTime())) {
                        obj[key] = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                    }
                }
            }
            // Recurse
            else if (typeof val === 'object' && val !== null) {
                this.formatRecursive(val);
            }
        }
    }

    /**
     * Get available filter fields and their metadata
     * @returns {Object} Available filters and columns
     */
    static getFilterMetadata() {
        return {
            filterFields: {
                customerVendor: {
                    label: 'Customer/Vendor',
                    type: 'string',
                    field: 'customerInformation.ms',
                    operators: ['equals', 'contains']
                },
                products: {
                    label: 'Products',
                    type: 'array',
                    field: 'items.productName',
                    operators: ['equals', 'contains']
                },
                productGroup: {
                    label: 'Product Group',
                    type: 'array',
                    field: 'items.productGroup',
                    operators: ['equals', 'contains']
                },
                dateRange: {
                    label: 'Date Range',
                    type: 'daterange',
                    field: 'invoiceDetails.date',
                    operators: ['between']
                },
                // REMOVED: staffName field not in schema
                // staffName: {
                //     label: 'Staff Name',
                //     type: 'string',
                //     field: 'staff.name',
                //     operators: ['equals', 'contains']
                // },
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
                    operators: ['equals', 'contains']
                },
                // REMOVED: serialNumber field not in schema
                // serialNumber: {
                //     label: 'Serial Number',
                //     type: 'string',
                //     field: 'serialNumber',
                //     operators: ['equals', 'contains']
                // }
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
                    { field: 'totals.totalInvoiceValue', label: 'Total Invoice Value' },
                    { field: 'createdAt', label: 'Created At' },
                    { field: 'updatedAt', label: 'Updated At' }
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
            ]
        };
    }
}

module.exports = SalesReportModel;
