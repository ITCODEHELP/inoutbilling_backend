const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const Product = require('../Product-Service-Model/Product');
const mongoose = require('mongoose');

class PurchaseReportModel {
    /**
     * Generate Purchase Report with Aggregation Pipeline
     * Optimized for 100M+ records using indexed matching and efficient pagination
     */
    static async getPurchaseReport(filters, options) {
        try {
            const {
                userId,
                customerVendor,
                productGroup,
                products,
                invoiceNumber,
                serialNo,
                staffId,
                fromDate,
                toDate,
                selectedColumns,
                invoiceSeries,
                groupingOptions
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'invoiceDetails.date',
                sortOrder = 'desc'
            } = options;

            const pipeline = [];
            const matchStage = {
                userId: new mongoose.Types.ObjectId(userId)
            };

            // --- 1. PRE-FETCH OPTIMIZATION (Product Groups) ---
            let productNamesFromGroup = [];
            if (productGroup && productGroup.length > 0) {
                // Ensure userId is ObjectId for Mongoose query consistency
                const productsInGroups = await Product.find({
                    userId: new mongoose.Types.ObjectId(userId),
                    productGroup: { $in: Array.isArray(productGroup) ? productGroup : [productGroup] }
                }).select('name').lean();

                productNamesFromGroup = productsInGroups.map(p => p.name);

                // If group selected but no products found, return empty immediately
                if (productNamesFromGroup.length === 0) {
                    return { success: true, data: { docs: [], totalDocs: 0, limit, totalPages: 0, page } };
                }
            }

            // --- 2. MATCH STAGE (Invoice Level Fields Only) ---
            // Removed item-level filtering from here to ensure Unwind happens first per requirements

            // Date Range (Index: invoiceDetails.date)
            if (fromDate || toDate) {
                matchStage['invoiceDetails.date'] = {};
                // Ensure valid Date objects
                if (fromDate) matchStage['invoiceDetails.date'].$gte = new Date(fromDate);
                if (toDate) {
                    const endOfDay = new Date(toDate);
                    endOfDay.setUTCHours(23, 59, 59, 999);
                    matchStage['invoiceDetails.date'].$lte = endOfDay;
                }
            }

            // Vendor/Customer
            if (customerVendor) {
                matchStage['vendorInformation.ms'] = { $regex: customerVendor, $options: 'i' };
            }

            // Invoice Number
            if (invoiceNumber) {
                matchStage['invoiceDetails.invoiceNumber'] = { $regex: invoiceNumber, $options: 'i' };
            }

            // Apply Invoice Level Match
            pipeline.push({ $match: matchStage });


            // --- 3. UNWIND & ITEM MATCH ---

            const itemColumns = ['Item Name', 'HSN/SAC', 'Quantity', 'Unit', 'Price', 'Discount', 'Tax', 'Amount'];
            const needsUnwind = selectedColumns && selectedColumns.some(col => itemColumns.includes(col));
            const hasProductFilters = (products && products.length > 0) || (productGroup && productGroup.length > 0);

            // Unwind if we need item columns OR if we have product filters
            if (needsUnwind || hasProductFilters) {
                pipeline.push({ $unwind: "$items" });

                // Apply Item Level Match AFTER Unwind
                if (hasProductFilters) {
                    const itemMatch = {};
                    const conditions = [];

                    // Filter by specific Products
                    if (products && products.length > 0) {
                        conditions.push({ 'items.productName': { $in: Array.isArray(products) ? products : [products] } });
                    }

                    // Filter by Product Group (using pre-fetched names)
                    if (productNamesFromGroup.length > 0) {
                        conditions.push({ 'items.productName': { $in: productNamesFromGroup } });
                    }

                    if (conditions.length > 0) {
                        // Combine conditions (Intersection: Product must match Selection AND Group if both present)
                        // Or if simplified logic, just merge. Assuming AND:
                        if (conditions.length === 1) {
                            itemMatch['items.productName'] = conditions[0]['items.productName'];
                        } else {
                            itemMatch.$and = conditions;
                        }
                        pipeline.push({ $match: itemMatch });
                    }
                }
            }

            // --- 4. FACET PAGINATION (Count + Skip/Limit) ---
            // Using $facet to get count and data in one go usually, 
            // but for 100M records, $facet can be slow if not early enough. 
            // Standard approach: $sort -> $skip -> $limit

            const sortStage = {};
            sortStage[sortBy] = sortOrder === 'asc' ? 1 : -1;

            pipeline.push({ $sort: sortStage });

            // Projection (Lean)
            const projectStage = {
                'Date': '$invoiceDetails.date',
                'Invoice No': '$invoiceDetails.invoiceNumber',
                'Vendor Name': '$vendorInformation.ms',
                'GSTIN': '$vendorInformation.gstinPan',
                'Payment Type': '$paymentType',
                'Mobile No': '$vendorInformation.phone',
                'Place of Supply': '$vendorInformation.placeOfSupply',

                // Invoice Totals
                'Total Taxable': '$totals.totalTaxable',
                'Total Tax': '$totals.totalTax',
                'Grand Total': '$totals.grandTotal',

                // Item Details (Valid only if unwound)
                'Item Name': '$items.productName',
                'HSN/SAC': '$items.hsnSac',
                'Quantity': '$items.qty',
                'Unit': '$items.uom',
                'Price': '$items.price',
                'Discount': '$items.discount', // Value
                // 'Tax': '$items.tax',
                'Amount': '$items.total'
            };

            // Dynamic Project based on selectedColumns could be added here to save bandwidth
            // pipeline.push({ $project: projectStage }); 
            // Keeping it simple: returning mapped document structure

            const paginationPipeline = [
                { $skip: (page - 1) * limit },
                { $limit: Number(limit) },
                { $project: projectStage }
            ];

            const countPipeline = [
                { $count: "total" }
            ];

            pipeline.push({
                $facet: {
                    docs: paginationPipeline,
                    totalCount: countPipeline
                }
            });

            // Execute
            const result = await PurchaseInvoice.aggregate(pipeline).allowDiskUse(true);

            const docs = result[0].docs || [];
            const total = result[0].totalCount[0] ? result[0].totalCount[0].total : 0;

            // --- 5. DATA TRANSFORMATION for Report ---
            // Map keys to requested columns strictly

            return {
                success: true,
                data: {
                    docs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page)
                }
            };

        } catch (error) {
            console.error('Purchase Report Error:', error);
            return {
                success: false,
                message: 'Failed to generate purchase report',
                error: error.message
            };
        }
    }

    static getFilterMetadata() {
        return {
            columns: [
                'Date', 'Invoice No', 'Vendor Name', 'GSTIN', 'Payment Type',
                'Mobile No', 'Place of Supply', 'Total Taxable', 'Total Tax', 'Grand Total',
                'Item Name', 'HSN/SAC', 'Quantity', 'Unit', 'Price', 'Discount', 'Amount'
            ],
            sortFields: ['invoiceDetails.date', 'totals.grandTotal', 'invoiceDetails.invoiceNumber']
        };
    }
}

module.exports = PurchaseReportModel;
