const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class ProductInsightsModel {
    /**
     * Get Top Selling Products
     */
    static async getTopProducts(filters) {
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
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    totalValue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
                    totalQty: { $sum: '$items.qty' }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    totalValue: { $round: ['$totalValue', 2] },
                    totalQty: 1
                }
            },
            { $sort: { totalValue: -1 } },
            { $limit: parseInt(limit) }
        ];

        return await SaleInvoice.aggregate(aggregation);
    }

    /**
     * Get Least Selling Products
     */
    static async getLeastProducts(filters) {
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
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.productName',
                    totalValue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
                    totalQty: { $sum: '$items.qty' }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    totalValue: { $round: ['$totalValue', 2] },
                    totalQty: 1
                }
            },
            { $sort: { totalValue: 1 } }, // Least selling first
            { $limit: parseInt(limit) }
        ];

        return await SaleInvoice.aggregate(aggregation);
    }
}

module.exports = ProductInsightsModel;
