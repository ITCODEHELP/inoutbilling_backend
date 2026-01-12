const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class PartyInsightsModel {
    /**
     * Get Top Customers by Sales
     */
    static async getTopCustomers(filters) {
        const { userId, fromDate, toDate, branchId, limit = 10 } = filters;

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

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: '$customerInformation.ms',
                    totalValue: { $sum: '$totals.grandTotal' },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    totalValue: { $round: ['$totalValue', 2] },
                    invoiceCount: 1
                }
            },
            { $sort: { totalValue: -1 } },
            { $limit: parseInt(limit) }
        ];

        return await SaleInvoice.aggregate(aggregation);
    }

    /**
     * Get Top Vendors by Purchase
     */
    static async getTopVendors(filters) {
        const { userId, fromDate, toDate, branchId, limit = 10 } = filters;

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

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: '$vendorInformation.ms',
                    totalValue: { $sum: '$totals.grandTotal' },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    totalValue: { $round: ['$totalValue', 2] },
                    invoiceCount: 1
                }
            },
            { $sort: { totalValue: -1 } },
            { $limit: parseInt(limit) }
        ];

        return await PurchaseInvoice.aggregate(aggregation);
    }
}

module.exports = PartyInsightsModel;
