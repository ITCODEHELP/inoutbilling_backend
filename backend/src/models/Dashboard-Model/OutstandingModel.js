const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const InwardPayment = require('../Payment-Model/InwardPayment');
const OutwardPayment = require('../Payment-Model/OutwardPayment');

class OutstandingModel {
    /**
     * Get Outstanding Summary (Receivables and Payables)
     */
    static async getSummary(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (branchId) {
            match['branchId'] = new mongoose.Types.ObjectId(branchId);
        }

        const buildMatchWithDate = (dateField) => {
            const m = { ...match };
            if (fromDate || toDate) {
                m[dateField] = {};
                if (fromDate) m[dateField].$gte = new Date(fromDate);
                if (toDate) m[dateField].$lte = new Date(toDate);
            }
            return m;
        };

        // Receivables: Sale Invoices - Inward Payments
        const salesAgg = [
            { $match: buildMatchWithDate('invoiceDetails.date') },
            { $group: { _id: null, totalSales: { $sum: '$totals.grandTotal' } } }
        ];

        const inwardAgg = [
            { $match: buildMatchWithDate('paymentDate') },
            { $group: { _id: null, totalReceived: { $sum: '$amount' } } }
        ];

        // Payables: Purchase Invoices - Outward Payments
        const purchaseAgg = [
            { $match: buildMatchWithDate('invoiceDetails.date') },
            { $group: { _id: null, totalPurchases: { $sum: '$totals.grandTotal' } } }
        ];

        const outwardAgg = [
            { $match: buildMatchWithDate('paymentDate') },
            { $group: { _id: null, totalPaid: { $sum: '$amount' } } }
        ];

        const [sales, inward, purchases, outward] = await Promise.all([
            SaleInvoice.aggregate(salesAgg),
            InwardPayment.aggregate(inwardAgg),
            PurchaseInvoice.aggregate(purchaseAgg),
            OutwardPayment.aggregate(outwardAgg)
        ]);

        const totalSales = sales[0] ? sales[0].totalSales : 0;
        const totalReceived = inward[0] ? inward[0].totalReceived : 0;
        const totalPurchases = purchases[0] ? purchases[0].totalPurchases : 0;
        const totalPaid = outward[0] ? outward[0].totalPaid : 0;

        const totalReceivable = totalSales - totalReceived;
        const totalPayable = totalPurchases - totalPaid;

        return {
            totalReceivable: Math.round(totalReceivable * 100) / 100,
            totalPayable: Math.round(totalPayable * 100) / 100,
            totalSales,
            totalReceived,
            totalPurchases,
            totalPaid
        };
    }

    /**
     * Get Aging Report (Current/Overdue)
     */
    static async getAging(filters) {
        const { userId, fromDate, toDate, branchId } = filters;
        const today = new Date();

        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (fromDate || toDate) {
            match['invoiceDetails.date'] = {};
            if (fromDate) match['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) match['invoiceDetails.date'].$lte = new Date(toDate);
        }

        if (branchId) match.branchId = new mongoose.Types.ObjectId(branchId);

        const agingAgg = [
            { $match: match },
            {
                $project: {
                    grandTotal: '$totals.grandTotal',
                    isOverdue: { $lt: ['$dueDate', today] },
                    daysOverdue: {
                        $cond: {
                            if: { $lt: ['$dueDate', today] },
                            then: { $divide: [{ $subtract: [today, '$dueDate'] }, 1000 * 60 * 60 * 24] },
                            else: 0
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    current: {
                        $sum: { $cond: [{ $eq: ['$isOverdue', false] }, '$grandTotal', 0] }
                    },
                    overdue: {
                        $sum: { $cond: [{ $eq: ['$isOverdue', true] }, '$grandTotal', 0] }
                    },
                    overdue1to30: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$isOverdue', true] }, { $lte: ['$daysOverdue', 30] }] }, '$grandTotal', 0] }
                    },
                    overdue31to60: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$isOverdue', true] }, { $gt: ['$daysOverdue', 30] }, { $lte: ['$daysOverdue', 60] }] }, '$grandTotal', 0] }
                    },
                    overdueAbove60: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$isOverdue', true] }, { $gt: ['$daysOverdue', 60] }] }, '$grandTotal', 0] }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    current: { $round: ['$current', 2] },
                    overdue: { $round: ['$overdue', 2] },
                    agingBuckets: [
                        { label: '1-30 Days', value: { $round: ['$overdue1to30', 2] } },
                        { label: '31-60 Days', value: { $round: ['$overdue31to60', 2] } },
                        { label: '60+ Days', value: { $round: ['$overdueAbove60', 2] } }
                    ]
                }
            }
        ];

        const result = await SaleInvoice.aggregate(agingAgg);
        return result[0] || { current: 0, overdue: 0, agingBuckets: [] };
    }
}

module.exports = OutstandingModel;
