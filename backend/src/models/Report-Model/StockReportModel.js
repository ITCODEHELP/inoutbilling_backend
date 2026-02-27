const mongoose = require('mongoose');
const User = require('../User-Model/User');
const Product = require('../Product-Service-Model/Product');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class StockReportModel {

    static async getStockReport(filters = {}, options = {}) {
        try {
            const {
                productId,
                productGroupId,
                productName,
                productGroup,
                hsnCode,
                stockAsOnDate,
                minStock,
                maxStock,
                hideZeroStock,
                showSellValue = true,
                showPurchaseValue = true,
                documentType = 'Stock Report',
                userId
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'name',
                sortOrder = 'asc'
            } = options;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const activeUserId = new mongoose.Types.ObjectId(userId);
            const pipeline = [];

            // Date helper
            const dateMatch = {};
            if (stockAsOnDate) {
                const eod = new Date(stockAsOnDate);
                eod.setUTCHours(23, 59, 59, 999);
                dateMatch.$lte = eod;
            }

            /* ---------------- PART 1: UNION STREAMS ---------------- */

            // 1. PRODUCT STREAM (Base)
            // Use Name as key.
            const productMatch = { userId: activeUserId, itemType: 'Product' };
            if (productId) productMatch._id = new mongoose.Types.ObjectId(productId);
            if (productName && typeof productName === 'string') productMatch.name = { $regex: productName, $options: 'i' };
            if (productGroupId) productMatch.productGroup = productGroupId;
            if (productGroup) {
                if (Array.isArray(productGroup) && productGroup.length > 0) {
                    productMatch.productGroup = { $in: productGroup };
                } else if (typeof productGroup === 'string' && productGroup.trim() !== '') {
                    productMatch.productGroup = { $regex: productGroup, $options: 'i' };
                }
            }
            if (hsnCode && typeof hsnCode === 'string') productMatch.hsnSac = { $regex: hsnCode, $options: 'i' };

            pipeline.push({ $match: productMatch });
            pipeline.push({
                $project: {
                    userId: 1,
                    type: { $literal: 'Product' },
                    productId: '$_id',
                    name: '$name', // Key
                    productGroup: '$productGroup',
                    hsnSac: '$hsnSac',
                    unit: '$unitOfMeasurement',
                    sellPrice: '$sellPrice',
                    purchasePrice: '$purchasePrice',
                    lowStockAlert: { $ifNull: ['$lowStockAlert', 0] },
                    // Opening Stock
                    qty: { $ifNull: ['$availableQuantity', 0] }
                }
            });

            // 2. SALES STREAM (Decrease Stock)
            const saleMatch = { userId: activeUserId };
            if (Object.keys(dateMatch).length > 0) saleMatch['invoiceDetails.date'] = dateMatch;

            pipeline.push({
                $unionWith: {
                    coll: 'saleinvoices',
                    pipeline: [
                        { $match: saleMatch },
                        { $unwind: '$items' },
                        {
                            $project: {
                                userId: 1,
                                type: { $literal: 'Tx' },
                                name: '$items.productName', // Match by Name
                                qty: { $multiply: [{ $ifNull: ['$items.qty', 0] }, -1] },
                                sellPrice: '$items.price'
                            }
                        }
                    ]
                }
            });

            // 3. PURCHASE STREAM (Increase Stock)
            const purchaseMatch = { userId: activeUserId };
            if (Object.keys(dateMatch).length > 0) purchaseMatch['invoiceDetails.date'] = dateMatch;

            pipeline.push({
                $unionWith: {
                    coll: 'purchaseinvoices',
                    pipeline: [
                        { $match: purchaseMatch },
                        { $unwind: '$items' },
                        {
                            $project: {
                                userId: 1,
                                type: { $literal: 'Tx' },
                                name: '$items.productName', // Match by Name
                                qty: { $ifNull: ['$items.qty', 0] },
                                purchasePrice: '$items.price'
                            }
                        }
                    ]
                }
            });

            // Safety Match
            pipeline.push({ $match: { userId: activeUserId } });

            /* ---------------- PART 2: GROUP & CALCULATE ---------------- */

            pipeline.push({
                $group: {
                    _id: '$name', // Group by NAME

                    // Metadata from Product doc
                    productId: { $max: '$productId' },
                    productGroup: { $max: '$productGroup' },
                    hsnSac: { $max: '$hsnSac' },
                    unit: { $max: '$unit' },
                    sellPrice: { $max: '$sellPrice' },
                    purchasePrice: { $max: '$purchasePrice' },
                    lowStockAlert: { $max: '$lowStockAlert' },

                    stock: { $sum: '$qty' }, // Sum Opening + Purchase - Sale (+/- Adjustments implicitly via qty)

                    // Ensure Product doc exists
                    docPresent: { $max: { $cond: [{ $eq: ['$type', 'Product'] }, 1, 0] } }
                }
            });

            // Remove orphan filter; rely strictly on base Product collection
            // pipeline.push({ $match: { docPresent: 1 } });

            /* ---------------- PART 3: VALUES & FILTERS ---------------- */

            pipeline.push({
                $addFields: {
                    productName: '$_id',
                    sellValue: {
                        $multiply: [
                            { $convert: { input: '$stock', to: 'double', onError: 0, onNull: 0 } },
                            { $convert: { input: '$sellPrice', to: 'double', onError: 0, onNull: 0 } }
                        ]
                    },
                    purchaseValue: {
                        $multiply: [
                            { $convert: { input: '$stock', to: 'double', onError: 0, onNull: 0 } },
                            { $convert: { input: '$purchasePrice', to: 'double', onError: 0, onNull: 0 } }
                        ]
                    }
                }
            });

            // Prevent negative zeros (-0) formatting issues
            pipeline.push({
                $addFields: {
                    sellValue: {
                        $cond: [{ $eq: ['$sellValue', 0] }, 0, '$sellValue']
                    },
                    purchaseValue: {
                        $cond: [{ $eq: ['$purchaseValue', 0] }, 0, '$purchaseValue']
                    }
                }
            });

            if (hideZeroStock) {
                pipeline.push({ $match: { stock: { $ne: 0 } } });
            }

            if (minStock !== undefined && minStock !== '') {
                pipeline.push({ $match: { stock: { $gte: Number(minStock) } } });
            }
            if (maxStock !== undefined && maxStock !== '') {
                pipeline.push({ $match: { stock: { $lte: Number(maxStock) } } });
            }

            // --- 'Low Stock Report' Filter ---
            if (documentType === 'Low Stock Report' || documentType === 'Low Stock') {
                pipeline.push({
                    $addFields: {
                        numericLowStock: { $convert: { input: '$lowStockAlert', to: 'double', onError: 0, onNull: 0 } },
                        numericStock: { $convert: { input: '$stock', to: 'double', onError: 0, onNull: 0 } }
                    }
                });
                pipeline.push({
                    $match: {
                        $expr: {
                            $lte: ['$numericStock', '$numericLowStock']
                        }
                    }
                });
            }

            // Cleanup explicitly unwanted fields
            const finalProjection = {
                _id: 0,
                productId: 1,
                productName: 1,
                stock: 1,
                productGroup: 1,
                hsnSac: 1,
                unit: 1,
                sellValue: 1,
                purchaseValue: 1
            };

            pipeline.push({ $project: finalProjection });

            /* ---------------- PART 4: PAGINATION & TOTALS ---------------- */

            const sortStage = {};
            const mapSort = {
                'name': 'productName',
                'productName': 'productName',
                'productGroup': 'productGroup',
                'stock': 'stock',
                'sellValue': 'sellValue',
                'purchaseValue': 'purchaseValue'
            };
            const sortKey = mapSort[sortBy] || 'productName';
            sortStage[sortKey] = sortOrder === 'asc' ? 1 : -1;
            pipeline.push({ $sort: sortStage });

            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: "total" }],
                    grandTotals: [
                        {
                            $group: {
                                _id: null,
                                totalStockQty: { $sum: '$stock' },
                                totalSellValue: { $sum: '$sellValue' },
                                totalPurchaseValue: { $sum: '$purchaseValue' }
                            }
                        }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline).allowDiskUse(true);
            const rawDocs = result[0]?.docs || [];
            const total = result[0]?.totalCount?.[0]?.total || 0;
            const grandTotals = result[0]?.grandTotals?.[0] || { totalStockQty: 0 };

            // Remove null fields from docs mapping
            const docs = rawDocs.map(doc => {
                const cleaned = {};

                // Explicitly order properties for the frontend/export
                if (doc.productName !== undefined) cleaned.productName = doc.productName;
                if (doc.stock !== undefined) cleaned.stock = doc.stock;

                for (const [key, value] of Object.entries(doc)) {
                    if (value !== null && key !== 'productName' && key !== 'stock') {
                        cleaned[key] = value;
                    }
                }
                return cleaned;
            });

            return {
                success: true,
                data: {
                    docs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit) || 1,
                    page: Number(page),
                    summary: {
                        totalStockQty: grandTotals.totalStockQty || 0,
                        totalSellValue: grandTotals.totalSellValue || 0,
                        totalPurchaseValue: grandTotals.totalPurchaseValue || 0
                    }
                },
                message: "Stock Report generated successfully"
            };

        } catch (error) {
            console.error('Stock Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static async getStockDetails(filters = {}, options = {}) {
        try {
            const { productId, productName, stockAsOnDate, userId } = filters;
            const { page = 1, limit = 10 } = options;

            if ((!productId && !productName) || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: false, message: 'Invalid or missing product reference/userId' };
            }

            const activeUserId = new mongoose.Types.ObjectId(userId);
            let product;
            if (productId) {
                product = await Product.findOne({ _id: productId, userId: activeUserId });
            } else if (productName) {
                // To safely construct ObjectID context, we lookup by name and user
                product = await Product.findOne({ name: productName, userId: activeUserId });
            }

            // If product document does not exist, it might be an orphan from historical invoices.
            // We can still drill down using the string name but start with 0 hard stock!
            if (!product && !productName) {
                return { success: false, message: 'Product not found and name not provided' };
            }

            const targetProductName = product ? product.name : productName;

            // Date filtering
            const dateMatch = {};
            if (stockAsOnDate) {
                const eod = new Date(stockAsOnDate);
                eod.setUTCHours(23, 59, 59, 999);
                dateMatch.$lte = eod;
            }

            // Fetch running aggregation
            const pipeline = [];

            // opening stock if exists
            let openingStock = product ? (product.availableQuantity || 0) : 0;
            let purchasePrice = product ? (product.purchasePrice || 0) : 0;

            // 1. Purchase Invoices (Inward)
            const purchaseMatch = { userId: activeUserId };
            if (Object.keys(dateMatch).length > 0) purchaseMatch['invoiceDetails.date'] = dateMatch;

            pipeline.push({
                $unionWith: {
                    coll: 'purchaseinvoices',
                    pipeline: [
                        { $match: purchaseMatch },
                        { $unwind: '$items' },
                        { $match: { 'items.productName': targetProductName } },
                        {
                            $project: {
                                _id: 0,
                                type: { $literal: 'Purchase' },
                                docNo: '$invoiceDetails.invoiceNumber',
                                date: '$invoiceDetails.date',
                                quantityIn: { $ifNull: ['$items.qty', 0] },
                                quantityOut: { $literal: 0 },
                                price: { $ifNull: ['$items.price', 0] },
                                total: { $ifNull: ['$items.total', 0] }
                            }
                        }
                    ]
                }
            });

            // 2. Sale Invoices (Outward)
            const saleMatch = { userId: activeUserId };
            if (Object.keys(dateMatch).length > 0) saleMatch['invoiceDetails.date'] = dateMatch;

            pipeline.push({
                $unionWith: {
                    coll: 'saleinvoices',
                    pipeline: [
                        { $match: saleMatch },
                        { $unwind: '$items' },
                        { $match: { 'items.productName': targetProductName } },
                        {
                            $project: {
                                _id: 0,
                                type: { $literal: 'Sale' },
                                docNo: '$invoiceDetails.invoiceNumber',
                                date: '$invoiceDetails.date',
                                quantityIn: { $literal: 0 },
                                quantityOut: { $ifNull: ['$items.qty', 0] },
                                price: { $ifNull: ['$items.price', 0] },
                                total: { $ifNull: ['$items.total', 0] }
                            }
                        }
                    ]
                }
            });

            // We do not have a base collection started in this pipeline approach if it's purely $unionWith. 
            // We use the User collection since activeUserId is guaranteed to exist.
            const fullPipeline = [
                { $match: { _id: activeUserId } }, // Guarantee exactly 1 doc 
                { $limit: 1 },
                {
                    $project: {
                        _id: 0,
                        type: { $literal: 'Opening Stock' },
                        docNo: { $literal: 'OPENING' },
                        date: { $literal: new Date('1970-01-01') }, // way back
                        quantityIn: { $literal: openingStock },
                        quantityOut: { $literal: 0 },
                        price: { $literal: purchasePrice },
                        total: { $literal: openingStock * purchasePrice }
                    }
                },
                ...pipeline,
                { $sort: { date: 1 } }
            ];

            const transactions = await User.aggregate(fullPipeline).allowDiskUse(true);

            // Calculate running balance purely in javascript since it's easier to paginate natively
            let currentBalance = 0;
            const computedTxs = transactions.map(tx => {
                currentBalance = currentBalance + tx.quantityIn - tx.quantityOut;
                return {
                    ...tx,
                    date: tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : tx.date,
                    balance: currentBalance
                };
            });

            const finalStock = currentBalance;
            const totalDocs = computedTxs.length;

            // Manual pagination after sorting and computing balance
            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const skip = (pageNum - 1) * limitNum;
            const paginatedDocs = computedTxs.slice(skip, skip + limitNum);

            return {
                success: true,
                data: {
                    docs: paginatedDocs,
                    totalDocs,
                    summary: {
                        finalStock
                    }
                },
                message: "Stock details fetched successfully"
            };

        } catch (error) {
            console.error('Stock Details Error:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = StockReportModel;
