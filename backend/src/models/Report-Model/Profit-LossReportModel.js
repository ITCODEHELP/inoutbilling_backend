const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const DailyExpense = require('../Expense-Income-Model/DailyExpense');
const StockReportModel = require('./StockReportModel');

class ProfitLossReportModel {

    // Alias for existing usages
    static async getProfitLossReport(filters = {}, options = {}) {
        return this.getProfitLossSummary(filters, options);
    }

    static async getProfitLossSummary(filters = {}, options = {}) {
        try {
            const { fromDate, toDate, userId } = filters;
            const { page = 1, limit = 10 } = options;

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
                    name: { $literal: 'Sales' },
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

            /* ---------------- DAILY EXPENSE (EXPENSE) ---------------- */
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

            /* ---------------- FETCH ALL ---------------- */
            const openingStockDate = fromDate ? new Date(new Date(fromDate).getTime() - 86400000).toISOString() : '1970-01-01T00:00:00.000Z';
            const closingStockDate = toDate ? new Date(toDate).toISOString() : new Date().toISOString();

            const [rows, openingStockResult, closingStockResult] = await Promise.all([
                SaleInvoice.aggregate(pipeline).allowDiskUse(true),
                StockReportModel.getStockReport({ userId, stockAsOnDate: openingStockDate }, { limit: 1 }),
                StockReportModel.getStockReport({ userId, stockAsOnDate: closingStockDate }, { limit: 1 })
            ]);

            const openingStockValue = openingStockResult?.data?.totals?.totalPurchaseValue || 0;
            const closingStockValue = closingStockResult?.data?.totals?.totalPurchaseValue || 0;

            const defaults = [
                { name: 'Opening Stock Value', type: 'Expense', amount: openingStockValue },
                { name: 'Purchase', type: 'Expense', amount: 0 },
                { name: 'Expense', type: 'Expense', amount: 0 },
                { name: 'Sales', type: 'Income', amount: 0 },
                { name: 'Closing Stock Value', type: 'Income', amount: closingStockValue }
            ];

            const docs = defaults.map(d => {
                const found = rows.find(r => r.name === d.name);
                if (found) {
                    return { ...d, amount: found.amount };
                }
                return d;
            });

            let totalIncome = 0, totalExpense = 0;
            docs.forEach(d => {
                if (d.type === 'Income') totalIncome += d.amount;
                else totalExpense += d.amount;
            });

            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const skip = (pageNum - 1) * limitNum;
            const paginatedDocs = docs.slice(skip, skip + limitNum);

            return {
                success: true,
                data: {
                    docs: paginatedDocs,
                    totalDocs: docs.length,
                    limit: limitNum,
                    totalPages: Math.ceil(docs.length / limitNum),
                    page: pageNum,
                    summary: {
                        totalIncome,
                        totalExpense,
                        netProfit: totalIncome - totalExpense
                    }
                }
            };
        } catch (err) {
            console.error('P&L Summary Error:', err);
            return { success: false, message: err.message };
        }
    }

    static async getProfitLossDetails(filters = {}, options = {}) {
        try {
            const { name, fromDate, toDate, userId } = filters;
            const { page = 1, limit = 10 } = options;

            if (!name || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: false, message: 'Invalid or missing name/userId' };
            }

            const activeUserId = new mongoose.Types.ObjectId(userId);
            let docs = [];
            let totalDocs = 0;
            let totalAmount = 0;

            const pageNum = parseInt(page) || 1;
            const limitNum = parseInt(limit) || 10;
            const skip = (pageNum - 1) * limitNum;

            if (name === 'Sales') {
                const query = { userId: activeUserId };
                if (fromDate || toDate) {
                    query['invoiceDetails.date'] = {};
                    if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
                    if (toDate) {
                        const eod = new Date(toDate); eod.setUTCHours(23, 59, 59, 999);
                        query['invoiceDetails.date'].$lte = eod;
                    }
                }

                const invoices = await SaleInvoice.find(query)
                    .sort({ 'invoiceDetails.date': -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean();

                totalDocs = await SaleInvoice.countDocuments(query);

                const amountAggr = await SaleInvoice.aggregate([
                    { $match: query },
                    { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } }
                ]);
                totalAmount = amountAggr[0]?.total || 0;

                docs = invoices.map(inv => ({
                    date: inv.invoiceDetails?.date?.toISOString().split('T')[0] || '',
                    particulars: inv.customerInformation?.ms || '',
                    voucherNo: inv.invoiceDetails?.invoiceNumber || '',
                    amount: inv.totals?.grandTotal || 0
                }));
            }
            else if (name === 'Purchase') {
                const query = { userId: activeUserId };
                if (fromDate || toDate) {
                    query['invoiceDetails.date'] = {};
                    if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
                    if (toDate) {
                        const eod = new Date(toDate); eod.setUTCHours(23, 59, 59, 999);
                        query['invoiceDetails.date'].$lte = eod;
                    }
                }

                const invoices = await PurchaseInvoice.find(query)
                    .sort({ 'invoiceDetails.date': -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean();

                totalDocs = await PurchaseInvoice.countDocuments(query);

                const amountAggr = await PurchaseInvoice.aggregate([
                    { $match: query },
                    { $group: { _id: null, total: { $sum: '$totals.grandTotal' } } }
                ]);
                totalAmount = amountAggr[0]?.total || 0;

                docs = invoices.map(inv => ({
                    date: inv.invoiceDetails?.date?.toISOString().split('T')[0] || '',
                    particulars: inv.vendorInformation?.ms || '',
                    voucherNo: inv.invoiceDetails?.invoiceNumber || '',
                    amount: inv.totals?.grandTotal || 0
                }));
            }
            else if (name === 'Expense') {
                const query = { userId: activeUserId };
                if (fromDate || toDate) {
                    query.expenseDate = {};
                    if (fromDate) query.expenseDate.$gte = new Date(fromDate);
                    if (toDate) {
                        const eod = new Date(toDate); eod.setUTCHours(23, 59, 59, 999);
                        query.expenseDate.$lte = eod;
                    }
                }

                const expenses = await DailyExpense.find(query)
                    .sort({ expenseDate: -1 })
                    .skip(skip)
                    .limit(limitNum)
                    .lean();

                totalDocs = await DailyExpense.countDocuments(query);

                const amountAggr = await DailyExpense.aggregate([
                    { $match: query },
                    { $group: { _id: null, total: { $sum: '$grandTotal' } } }
                ]);
                totalAmount = amountAggr[0]?.total || 0;

                docs = expenses.map(exp => ({
                    date: exp.expenseDate?.toISOString().split('T')[0] || '',
                    particulars: exp.category || 'Expense',
                    voucherNo: exp.expenseNo || '',
                    amount: exp.grandTotal || 0
                }));
            }
            else if (name === 'Opening Stock Value' || name === 'Closing Stock Value') {
                const stockAsOnDate = name === 'Opening Stock Value'
                    ? (fromDate ? new Date(new Date(fromDate).getTime() - 86400000).toISOString() : '1970-01-01T00:00:00.000Z')
                    : (toDate ? new Date(toDate).toISOString() : new Date().toISOString());

                const stockResult = await StockReportModel.getStockReport({
                    userId,
                    stockAsOnDate
                }, { page: pageNum, limit: limitNum });

                if (stockResult.success) {
                    totalDocs = stockResult.data.totalDocs;
                    totalAmount = stockResult.data.totals?.totalPurchaseValue || 0;
                    docs = stockResult.data.docs.map(st => ({
                        date: name === 'Opening Stock Value' ? (fromDate || '-') : (toDate || new Date().toISOString().split('T')[0]),
                        particulars: st.name || '',
                        voucherNo: st.hsnSac || '-',
                        amount: st.purchaseValue || 0
                    }));
                }
            }
            else {
                return { success: false, message: 'Invalid section name for details' };
            }

            return {
                success: true,
                data: {
                    docs,
                    totalDocs,
                    limit: limitNum,
                    totalPages: Math.ceil(totalDocs / limitNum) || 1,
                    page: pageNum,
                    summary: {
                        totalAmount
                    }
                },
                message: `${name} details fetched successfully`
            };

        } catch (error) {
            console.error('P&L Details Error:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = ProfitLossReportModel;
