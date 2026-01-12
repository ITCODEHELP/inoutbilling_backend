const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class InvoiceTrendsModel {
    /**
     * Get Monthly Trends for Sales and Purchases
     */
    static async getTrends(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (fromDate || toDate) {
            match['invoiceDetails.date'] = {};
            if (fromDate) match['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) match['invoiceDetails.date'].$lte = new Date(toDate);
        }

        if (branchId) {
            match.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const salesAgg = [
            { $match: match },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$invoiceDetails.date" } },
                    amount: { $sum: "$totals.grandTotal" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const purchaseAgg = [
            { $match: match },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$invoiceDetails.date" } },
                    amount: { $sum: "$totals.grandTotal" },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const [sales, purchases] = await Promise.all([
            SaleInvoice.aggregate(salesAgg),
            PurchaseInvoice.aggregate(purchaseAgg)
        ]);

        return {
            salesTrends: sales,
            purchaseTrends: purchases
        };
    }
}

module.exports = InvoiceTrendsModel;
