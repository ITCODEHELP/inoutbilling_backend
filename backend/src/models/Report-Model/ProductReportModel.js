const mongoose = require('mongoose');
const Product = require('../Product-Service-Model/Product');

class ProductReportModel {

    static getFilterMetadata() {
        return {
            columns: [
                { field: 'productName', label: 'Product Name' },
                { field: 'transactionDate', label: 'Transaction Date' },
                { field: 'transactionInfo', label: 'Transaction Info' },
                { field: 'productGroup', label: 'Product Group' },
                { field: 'companyName', label: 'Company Name' },
                { field: 'docNo', label: 'Doc No.' },
                { field: 'unitPrice', label: 'Unit Price' },
                { field: 'stockIn', label: 'Stock In' },
                { field: 'stockOut', label: 'Stock Out' }
            ]
        };
    }

    static async getProductReport(filters = {}, options = {}) {
        try {
            const activeUserId = new mongoose.Types.ObjectId(filters.userId);

            // 1. Target Product Resolution
            const productFilter = { userId: activeUserId };
            let enforceProductMaster = false;

            if (filters.productName && filters.productName.length > 0) {
                if (Array.isArray(filters.productName)) {
                    productFilter.name = { $in: filters.productName };
                } else {
                    productFilter.name = { $regex: filters.productName, $options: 'i' };
                }
            }
            if (filters.productGroup && filters.productGroup.length > 0) {
                if (Array.isArray(filters.productGroup)) {
                    productFilter.productGroup = { $in: filters.productGroup };
                } else {
                    productFilter.productGroup = { $regex: filters.productGroup, $options: 'i' };
                }
                enforceProductMaster = true; // Necessitates actual master-level categorization lookup
            }
            if (filters.showStockAdjustedOnly) {
                productFilter.itemType = 'Product';
                enforceProductMaster = true;
            }

            let itemMatch = {};

            if (Object.keys(productFilter).length > 1) { // Means they requested name, group, or stock filter
                const matchingProducts = await Product.find(productFilter).select('name');
                const targetNames = matchingProducts.map(p => p.name);

                if (targetNames.length === 0) {
                    if (enforceProductMaster) {
                        // Filter was strict (requested a category or stock flag) but found absolutely no master matches. Safe to return empty.
                        return {
                            success: true,
                            data: { docs: [], products: [], pagination: { total: 0, page: 1, limit: options.limit || 10, totalPages: 1 } }
                        };
                    } else {
                        // They only searched Product Name but it doesn't exist in the master table! It might just be freeform invoice text!
                        if (Array.isArray(filters.productName)) {
                            itemMatch = { 'items.productName': { $in: filters.productName } };
                        } else {
                            itemMatch = { 'items.productName': { $regex: filters.productName, $options: 'i' } };
                        }
                    }
                } else {
                    // Valid master matches
                    itemMatch = { 'items.productName': { $in: targetNames } };
                }
            }

            // 2. Transaction Matches
            const txMatch = { userId: activeUserId };
            const dateMatch = {};
            if (filters.fromDate) dateMatch.$gte = new Date(filters.fromDate);
            if (filters.toDate) {
                const to = new Date(filters.toDate);
                to.setUTCHours(23, 59, 59, 999);
                dateMatch.$lte = to;
            }
            if (Object.keys(dateMatch).length > 0) {
                txMatch['invoiceDetails.date'] = dateMatch;
            }

            const pipeline = [];

            // Base Stream: Purchase Invoices
            pipeline.push({ $match: txMatch });
            pipeline.push({ $unwind: '$items' });
            if (Object.keys(itemMatch).length > 0) pipeline.push({ $match: itemMatch });

            pipeline.push({
                $project: {
                    _id: 0,
                    productName: '$items.productName',
                    transactionDate: '$invoiceDetails.date',
                    transactionInfo: { $literal: 'Purchase' },
                    companyName: '$supplierDetails.supplierName',
                    docNo: '$invoiceDetails.invoiceNumber',
                    unitPrice: '$items.price',
                    stockIn: { $ifNull: ['$items.qty', 0] },
                    stockOut: { $literal: 0 }
                }
            });

            // Union Stream: Sale Invoices
            pipeline.push({
                $unionWith: {
                    coll: 'saleinvoices',
                    pipeline: [
                        { $match: txMatch },
                        { $unwind: '$items' },
                        ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
                        {
                            $project: {
                                _id: 0,
                                productName: '$items.productName',
                                transactionDate: '$invoiceDetails.date',
                                transactionInfo: { $literal: 'Sale' },
                                companyName: '$customerDetails.customerName',
                                docNo: '$invoiceDetails.invoiceNumber',
                                unitPrice: '$items.price',
                                stockIn: { $literal: 0 },
                                stockOut: { $ifNull: ['$items.qty', 0] }
                            }
                        }
                    ]
                }
            });

            // Union Stream: Delivery Challan
            pipeline.push({
                $unionWith: {
                    coll: 'deliverychallans',
                    pipeline: [
                        { $match: txMatch },
                        { $unwind: '$items' },
                        ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
                        {
                            $project: {
                                _id: 0,
                                productName: '$items.productName',
                                transactionDate: '$invoiceDetails.date',
                                transactionInfo: { $literal: 'Delivery Challan' },
                                companyName: '$customerDetails.customerName',
                                docNo: '$invoiceDetails.invoiceNumber',
                                unitPrice: '$items.price',
                                stockIn: { $literal: 0 },
                                stockOut: { $ifNull: ['$items.qty', 0] }
                            }
                        }
                    ]
                }
            });

            // Union Stream: Credit Notes (Return from Customer -> Stock In)
            pipeline.push({
                $unionWith: {
                    coll: 'creditnotes',
                    pipeline: [
                        { $match: txMatch },
                        { $unwind: '$items' },
                        ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
                        {
                            $project: {
                                _id: 0,
                                productName: '$items.productName',
                                transactionDate: '$invoiceDetails.date',
                                transactionInfo: { $literal: 'Credit Note' },
                                companyName: '$customerDetails.customerName',
                                docNo: '$invoiceDetails.invoiceNumber',
                                unitPrice: '$items.price',
                                stockIn: { $ifNull: ['$items.qty', 0] },
                                stockOut: { $literal: 0 }
                            }
                        }
                    ]
                }
            });

            // Union Stream: Debit Notes (Return to Supplier -> Stock Out)
            pipeline.push({
                $unionWith: {
                    coll: 'debitnotes',
                    pipeline: [
                        { $match: txMatch },
                        { $unwind: '$items' },
                        ...(Object.keys(itemMatch).length > 0 ? [{ $match: itemMatch }] : []),
                        {
                            $project: {
                                _id: 0,
                                productName: '$items.productName',
                                transactionDate: '$invoiceDetails.date',
                                transactionInfo: { $literal: 'Debit Note' },
                                companyName: '$supplierDetails.supplierName',
                                docNo: '$invoiceDetails.invoiceNumber',
                                unitPrice: '$items.price',
                                stockIn: { $literal: 0 },
                                stockOut: { $ifNull: ['$items.qty', 0] }
                            }
                        }
                    ]
                }
            });

            // Re-bind Product Group from Product Master Collection
            pipeline.push({
                $lookup: {
                    from: 'products',
                    let: { pName: '$productName', uId: activeUserId },
                    pipeline: [
                        { $match: { $expr: { $and: [{ $eq: ['$name', '$$pName'] }, { $eq: ['$userId', '$$uId'] }] } } },
                        { $project: { _id: 0, productGroup: 1 } }
                    ],
                    as: 'pData'
                }
            });

            pipeline.push({
                $addFields: {
                    productGroup: { $ifNull: [{ $arrayElemAt: ['$pData.productGroup', 0] }, ''] }
                }
            });
            pipeline.push({ $project: { pData: 0 } });

            // Ensure Sorting works correctly
            if (filters.groupRecordByProduct) {
                // Primary Sort by Product Name, then Date
                pipeline.push({ $sort: { productName: 1, transactionDate: 1 } });
            } else {
                // Global chronological sort
                pipeline.push({ $sort: { transactionDate: -1 } });
            }

            // Formatting
            pipeline.push({
                $addFields: {
                    transactionDate: {
                        $dateToString: { format: "%Y-%m-%d", date: "$transactionDate" }
                    }
                }
            });

            const page = options.page ? parseInt(options.page) : 1;
            const limit = options.limit ? parseInt(options.limit) : 50;
            const skip = (page - 1) * limit;

            pipeline.push({
                $facet: {
                    metadata: [{ $count: "total" }],
                    docs: [
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            });

            const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
            const result = await PurchaseInvoice.aggregate(pipeline).allowDiskUse(true);

            const docs = result[0].docs || [];
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

            // Structure data layout specifically for API constraints explicitly matching UI shape
            // The frontend map demands: { products: [ { productName: 'X', details: [...] } ] }
            const productsGrouped = {};
            docs.forEach(doc => {
                if (!productsGrouped[doc.productName]) {
                    productsGrouped[doc.productName] = { productName: doc.productName, details: [] };
                }
                productsGrouped[doc.productName].details.push(doc);
            });

            return {
                success: true,
                data: {
                    docs: docs, // Vital for export engine (ReportActionController)
                    products: Object.values(productsGrouped), // Vital for the JSON REST API response
                    columns: ProductReportModel.getFilterMetadata().columns,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

        } catch (error) {
            console.error('ProductReportModel Error:', error);
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }
}

module.exports = ProductReportModel;
