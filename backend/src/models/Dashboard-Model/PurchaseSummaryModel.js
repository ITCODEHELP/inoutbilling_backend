const mongoose = require('mongoose');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class PurchaseSummaryModel {
    /**
     * Get Purchase Summary for Dashboard
     * @param {Object} filters - userId, fromDate, toDate, branchId
     */
    static async getSummary(filters) {
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
            match['branchId'] = new mongoose.Types.ObjectId(branchId);
        }

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalPurchases: { $sum: '$totals.grandTotal' },
                    totalTaxable: { $sum: '$totals.totalTaxable' },
                    totalTax: { $sum: '$totals.totalTax' },
                    purchaseCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalPurchases: { $round: ['$totalPurchases', 2] },
                    totalTaxable: { $round: ['$totalTaxable', 2] },
                    totalTax: { $round: ['$totalTax', 2] },
                    purchaseCount: 1
                }
            }
        ];

        const result = await PurchaseInvoice.aggregate(aggregation);

        return result[0] || {
            totalPurchases: 0,
            totalTaxable: 0,
            totalTax: 0,
            purchaseCount: 0
        };
    }
}

module.exports = PurchaseSummaryModel;
