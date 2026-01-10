const mongoose = require('mongoose');
const Customer = require('../Customer-Vendor-Model/Customer');
const Vendor = require('../Customer-Vendor-Model/Vendor');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const InwardPayment = require('../Payment-Model/InwardPayment');
const OutwardPayment = require('../Payment-Model/OutwardPayment');

class CompanyOutstandingReportModel {

    static async getCompanyOutstandingReport(filters = {}, options = {}) {
        try {
            const {
                customerVendor,
                fromDate,
                toDate,
                userId,
                hideZeroOutstanding
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

            /* ---------------- PART 1: UNIFY ENTITIES & TRANSACTIONS ---------------- */

            const dateFilter = {};
            if (fromDate) dateFilter.$gte = new Date(fromDate);
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                dateFilter.$lte = eod;
            }

            // --- 1. Customer Stream (Opening Balance) ---
            const customerMatch = { userId: activeUserId };
            if (customerVendor) customerMatch.companyName = { $regex: customerVendor, $options: 'i' };

            pipeline.push({ $match: customerMatch });
            pipeline.push({
                $project: {
                    userId: 1, // Keep userId
                    name: '$companyName',
                    docType: { $literal: 'Opening' },
                    amount: {
                        $cond: [
                            { $eq: ['$openingBalance.type', 'Credit'] },
                            { $multiply: [{ $ifNull: ['$openingBalance.amount', 0] }, -1] },
                            { $ifNull: ['$openingBalance.amount', 0] }
                        ]
                    },
                    date: { $literal: new Date('1970-01-01') }
                }
            });

            // --- 2. Vendor Stream (Opening Balance) ---
            const vendorMatch = { userId: activeUserId };
            if (customerVendor) vendorMatch.companyName = { $regex: customerVendor, $options: 'i' };

            pipeline.push({
                $unionWith: {
                    coll: 'vendors',
                    pipeline: [
                        { $match: vendorMatch },
                        {
                            $project: {
                                userId: 1,
                                name: '$companyName',
                                docType: { $literal: 'Opening' },
                                amount: {
                                    $cond: [
                                        { $eq: ['$vendorBalance.type', 'DEBIT'] },
                                        { $ifNull: ['$vendorBalance.amount', 0] },
                                        { $multiply: [{ $ifNull: ['$openingBalance', 0] }, -1] }
                                    ]
                                },
                                date: { $literal: new Date('1970-01-01') }
                            }
                        }
                    ]
                }
            });

            // --- 3. Sale Invoice (Debit) ---
            const saleMatch = { userId: activeUserId };
            if (customerVendor) saleMatch['customerInformation.ms'] = { $regex: customerVendor, $options: 'i' };
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                saleMatch['invoiceDetails.date'] = { $lte: eod };
            }

            pipeline.push({
                $unionWith: {
                    coll: 'saleinvoices',
                    pipeline: [
                        { $match: saleMatch },
                        {
                            $project: {
                                userId: 1,
                                name: '$customerInformation.ms',
                                docType: { $literal: 'Transaction' },
                                amount: { $ifNull: ['$totals.grandTotal', 0] },
                                date: '$invoiceDetails.date'
                            }
                        }
                    ]
                }
            });

            // --- 4. Purchase Invoice (Credit) ---
            const purchaseMatch = { userId: activeUserId };
            if (customerVendor) purchaseMatch['vendorInformation.ms'] = { $regex: customerVendor, $options: 'i' };
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                purchaseMatch['invoiceDetails.date'] = { $lte: eod };
            }

            pipeline.push({
                $unionWith: {
                    coll: 'purchaseinvoices',
                    pipeline: [
                        { $match: purchaseMatch },
                        {
                            $project: {
                                userId: 1,
                                name: '$vendorInformation.ms',
                                docType: { $literal: 'Transaction' },
                                amount: { $multiply: [{ $ifNull: ['$totals.grandTotal', 0] }, -1] },
                                date: '$invoiceDetails.date'
                            }
                        }
                    ]
                }
            });

            // --- 5. Inward Payment (Credit) ---
            const payInMatch = { userId: activeUserId };
            if (customerVendor) payInMatch['companyName'] = { $regex: customerVendor, $options: 'i' };
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                payInMatch['paymentDate'] = { $lte: eod };
            }

            pipeline.push({
                $unionWith: {
                    coll: 'inwardpayments',
                    pipeline: [
                        { $match: payInMatch },
                        {
                            $project: {
                                userId: 1,
                                name: '$companyName',
                                docType: { $literal: 'Transaction' },
                                amount: { $multiply: [{ $ifNull: ['$amount', 0] }, -1] },
                                date: '$paymentDate'
                            }
                        }
                    ]
                }
            });

            // --- 6. Outward Payment (Debit) ---
            const payOutMatch = { userId: activeUserId };
            if (customerVendor) payOutMatch['companyName'] = { $regex: customerVendor, $options: 'i' };
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                payOutMatch['paymentDate'] = { $lte: eod };
            }

            pipeline.push({
                $unionWith: {
                    coll: 'outwardpayments',
                    pipeline: [
                        { $match: payOutMatch },
                        {
                            $project: {
                                userId: 1,
                                name: '$companyName',
                                docType: { $literal: 'Transaction' },
                                amount: { $ifNull: ['$amount', 0] },
                                date: '$paymentDate'
                            }
                        }
                    ]
                }
            });

            // Safety Match after Union to ensure NO leakage
            pipeline.push({ $match: { userId: activeUserId } });

            /* ---------------- PART 2: AGGREGATE ---------------- */

            const fromDateObj = fromDate ? new Date(fromDate) : null;

            pipeline.push({
                $group: {
                    _id: { userId: '$userId', name: '$name' }, // Composite grouping key

                    openingBalance: {
                        $sum: {
                            $cond: [
                                {
                                    $or: [
                                        { $eq: ['$docType', 'Opening'] },
                                        {
                                            $and: [
                                                { $eq: ['$docType', 'Transaction'] },
                                                { $ne: [fromDateObj, null] },
                                                { $lt: ['$date', fromDateObj] }
                                            ]
                                        }
                                    ]
                                },
                                '$amount',
                                0
                            ]
                        }
                    },

                    debit: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $gt: ['$amount', 0] },
                                        { $eq: ['$docType', 'Transaction'] },
                                        {
                                            $or: [
                                                { $eq: [fromDateObj, null] },
                                                { $gte: ['$date', fromDateObj] }
                                            ]
                                        }
                                    ]
                                },
                                '$amount',
                                0
                            ]
                        }
                    },

                    credit: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $lt: ['$amount', 0] },
                                        { $eq: ['$docType', 'Transaction'] },
                                        {
                                            $or: [
                                                { $eq: [fromDateObj, null] },
                                                { $gte: ['$date', fromDateObj] }
                                            ]
                                        }
                                    ]
                                },
                                { $abs: '$amount' },
                                0
                            ]
                        }
                    }
                }
            });

            pipeline.push({
                $addFields: {
                    closingBalance: {
                        $subtract: [
                            { $add: ['$openingBalance', '$debit'] },
                            '$credit'
                        ]
                    },
                    name: '$_id.name' // Flatten name for sorting and response
                }
            });

            /* ---------------- PART 3: FILTER & SORT ---------------- */

            if (hideZeroOutstanding) {
                pipeline.push({
                    $match: {
                        closingBalance: { $ne: 0 }
                    }
                });
            }

            const sortStage = {};
            const mapSort = {
                'name': 'name',
                'openingBalance': 'openingBalance',
                'debit': 'debit',
                'credit': 'credit',
                'closingBalance': 'closingBalance'
            };
            const sortKey = mapSort[sortBy] || 'name';
            sortStage[sortKey] = sortOrder === 'asc' ? 1 : -1;
            pipeline.push({ $sort: sortStage });

            /* ---------------- PART 4: PAGINATION ---------------- */
            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: "total" }]
                }
            });

            const result = await Customer.aggregate(pipeline).allowDiskUse(true);
            const docs = result[0]?.docs || [];
            const total = result[0]?.totalCount?.[0]?.total || 0;

            const finalDocs = docs.map(d => ({
                name: d.name, // Now retrieved from $addFields
                openingBalance: d.openingBalance,
                debit: d.debit,
                credit: d.credit,
                closingBalance: d.closingBalance
            }));

            return {
                success: true,
                data: {
                    docs: finalDocs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page)
                }
            };

        } catch (error) {
            console.error('Company Outstanding Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            columns: ['Name', 'Opening Balance', 'Debit', 'Credit', 'Closing Balance']
        };
    }
}

module.exports = CompanyOutstandingReportModel;
