const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class ProfitLossReportModel {

    static async getProfitLossReport(filters = {}) {
        try {
            const { fromDate, toDate, userId } = filters;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const activeUserId = new mongoose.Types.ObjectId(userId);

            const dateFilter = {};
            if (fromDate) dateFilter.$gte = new Date(fromDate);
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                dateFilter.$lte = eod;
            }

            const pipeline = [];

            /* ---------------- SALES (INCOME) ---------------- */
            pipeline.push({
                $match: {
                    userId: activeUserId,
                    ...(Object.keys(dateFilter).length && { 'invoiceDetails.date': dateFilter })
                }
            });

            pipeline.push({
                $project: {
                    type: { $literal: 'Income' },
                    name: { $literal: 'Sale' },
                    amount: { $ifNull: ['$totals.grandTotal', 0] }
                }
            });

            /* ---------------- PURCHASE (EXPENSE) ---------------- */
            pipeline.push({
                $unionWith: {
                    coll: 'purchaseinvoices',
                    pipeline: [
                        {
                            $match: {
                                userId: activeUserId,
                                ...(Object.keys(dateFilter).length && { 'invoiceDetails.date': dateFilter })
                            }
                        },
                        {
                            $project: {
                                type: { $literal: 'Expense' },
                                name: { $literal: 'Purchase' },
                                amount: { $ifNull: ['$totals.grandTotal', 0] }
                            }
                        }
                    ]
                }
            });

            /* ---------------- DAILY EXPENSE ---------------- */
            pipeline.push({
                $unionWith: {
                    coll: 'dailyexpenses',
                    pipeline: [
                        {
                            $match: {
                                userId: activeUserId,
                                ...(Object.keys(dateFilter).length && { expenseDate: dateFilter })
                            }
                        },
                        {
                            $project: {
                                type: { $literal: 'Expense' },
                                name: { $literal: 'Expense' },
                                amount: { $ifNull: ['$grandTotal', 0] }
                            }
                        }
                    ]
                }
            });

            /* ---------------- GROUP ---------------- */
            pipeline.push({
                $group: {
                    _id: { name: '$name', type: '$type' },
                    amount: { $sum: '$amount' }
                }
            });

            pipeline.push({
                $project: {
                    _id: 0,
                    name: '$_id.name',
                    type: '$_id.type',
                    amount: 1
                }
            });

            const rows = await SaleInvoice.aggregate(pipeline).allowDiskUse(true);

            /* ---------------- DEFAULT ROWS ---------------- */
            const defaults = [
                { name: 'Sale', type: 'Income', amount: 0 },
                { name: 'Purchase', type: 'Expense', amount: 0 },
                { name: 'Expense', type: 'Expense', amount: 0 }
            ];

            const docs = defaults.map(d =>
                rows.find(r => r.name === d.name && r.type === d.type) || d
            );

            let totalIncome = 0, totalExpense = 0;
            docs.forEach(d => {
                if (d.type === 'Income') totalIncome += d.amount;
                else totalExpense += d.amount;
            });

            return {
                success: true,
                data: {
                    docs,
                    totalDocs: docs.length,
                    limit: docs.length,
                    totalPages: 1,
                    page: 1,
                    summary: {
                        totalIncome,
                        totalExpense,
                        netProfit: totalIncome - totalExpense
                    }
                }
            };

        } catch (err) {
            console.error('P&L Error:', err);
            return { success: false, message: err.message };
        }
    }
}

module.exports = ProfitLossReportModel;
