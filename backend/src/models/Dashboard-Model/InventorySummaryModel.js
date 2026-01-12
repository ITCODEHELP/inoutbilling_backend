const mongoose = require('mongoose');
const Product = require('../Product-Service-Model/Product');

class InventorySummaryModel {
    /**
     * Get Inventory Summary
     */
    static async getSummary(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const match = {
            userId: new mongoose.Types.ObjectId(userId),
            itemType: 'Product'
        };

        if (fromDate || toDate) {
            match.createdAt = {};
            if (fromDate) match.createdAt.$gte = new Date(fromDate);
            if (toDate) match.createdAt.$lte = new Date(toDate);
        }

        if (branchId) {
            match.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    totalStockValue: { $sum: { $multiply: ['$qty', '$purchasePrice'] } },
                    lowStockItems: {
                        $sum: {
                            $cond: [{ $and: ['$manageStock', { $lte: ['$qty', '$lowStockAlert'] }] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalProducts: 1,
                    totalStockValue: { $round: ['$totalStockValue', 2] },
                    lowStockItems: 1
                }
            }
        ];

        const result = await Product.aggregate(aggregation);

        return result[0] || {
            totalProducts: 0,
            totalStockValue: 0,
            lowStockItems: 0
        };
    }
}

module.exports = InventorySummaryModel;
