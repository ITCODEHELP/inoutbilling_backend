const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class SalesSummaryModel {
    /**
     * Get Sales Summary for Dashboard
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

        // branchId filter (if applicable in schema)
        if (branchId) {
            match['branchId'] = new mongoose.Types.ObjectId(branchId);
        }

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totals.grandTotal' },
                    totalTaxable: { $sum: '$totals.totalTaxable' },
                    totalTax: { $sum: '$totals.totalTax' },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalSales: { $round: ['$totalSales', 2] },
                    totalTaxable: { $round: ['$totalTaxable', 2] },
                    totalTax: { $round: ['$totalTax', 2] },
                    invoiceCount: 1
                }
            }
        ];

        const result = await SaleInvoice.aggregate(aggregation);

        return result[0] || {
            totalSales: 0,
            totalTaxable: 0,
            totalTax: 0,
            invoiceCount: 0
        };
    }
}

module.exports = SalesSummaryModel;
