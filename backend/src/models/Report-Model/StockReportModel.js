const mongoose = require('mongoose');
const User = require('../User-Model/User');
const Product = require('../Product-Service-Model/Product');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class StockReportModel {

    static async getStockReport(filters = {}, options = {}) {
        try {
            const {
                productName,
                productGroup,
                hsnCode,
                stockAsOnDate,
                minStock,
                maxStock,
                hideZeroStock,
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
            if (productName) productMatch.name = { $regex: productName, $options: 'i' };
            if (productGroup) productMatch.productGroup = { $regex: productGroup, $options: 'i' };
            if (hsnCode) productMatch.hsnSac = { $regex: hsnCode, $options: 'i' };

            pipeline.push({ $match: productMatch });
            pipeline.push({
                $project: {
                    userId: 1,
                    type: { $literal: 'Product' },
                    name: '$name', // Key
                    productGroup: '$productGroup',
                    hsnSac: '$hsnSac',
                    sellPrice: '$sellPrice',
                    purchasePrice: '$purchasePrice',
                    // Opening Stock
                    qty: {
                        $cond: [
                            { $and: [{ $eq: ['$manageStock', true] }, { $eq: ['$stockType', 'Opening'] }] },
                            { $ifNull: ['$qty', 0] },
                            0
                        ]
                    }
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
                                qty: { $multiply: [{ $ifNull: ['$items.qty', 0] }, -1] }
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
                                qty: { $ifNull: ['$items.qty', 0] }
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
                    productGroup: { $first: '$productGroup' },
                    hsnSac: { $first: '$hsnSac' },
                    sellPrice: { $first: '$sellPrice' },
                    purchasePrice: { $first: '$purchasePrice' },

                    stock: { $sum: '$qty' }, // Sum Opening + Purchase - Sale (+/- Adjustments implicitly via qty)

                    // Ensure Product doc exists
                    docPresent: { $max: { $cond: [{ $eq: ['$type', 'Product'] }, 1, 0] } }
                }
            });

            // Filter orphans (transactions for products not in Product collection filters)
            pipeline.push({ $match: { docPresent: 1 } });

            /* ---------------- PART 3: VALUES & FILTERS ---------------- */

            pipeline.push({
                $addFields: {
                    name: '$_id',
                    sellValue: { $multiply: ['$stock', { $ifNull: ['$sellPrice', 0] }] },
                    purchaseValue: { $multiply: ['$stock', { $ifNull: ['$purchasePrice', 0] }] }
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

            /* ---------------- PART 4: PAGINATION & TOTALS ---------------- */

            const sortStage = {};
            const mapSort = {
                'name': 'name',
                'productGroup': 'productGroup',
                'stock': 'stock',
                'sellValue': 'sellValue',
                'purchaseValue': 'purchaseValue'
            };
            const sortKey = mapSort[sortBy] || 'name';
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
                                totalStock: { $sum: '$stock' },
                                totalSellValue: { $sum: '$sellValue' },
                                totalPurchaseValue: { $sum: '$purchaseValue' }
                            }
                        }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline).allowDiskUse(true);
            const docs = result[0]?.docs || [];
            const total = result[0]?.totalCount?.[0]?.total || 0;
            const grandTotals = result[0]?.grandTotals?.[0] || { totalStock: 0, totalSellValue: 0, totalPurchaseValue: 0 };

            const userDetails = await User.findById(activeUserId).select('companyName address city state pincode phone email').lean();

            return {
                success: true,
                data: {
                    docs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page),
                    companyDetails: userDetails,
                    totals: {
                        totalStock: grandTotals.totalStock,
                        totalSellValue: grandTotals.totalSellValue,
                        totalPurchaseValue: grandTotals.totalPurchaseValue
                    }
                }
            };

        } catch (error) {
            console.error('Stock Report Error:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = StockReportModel;
