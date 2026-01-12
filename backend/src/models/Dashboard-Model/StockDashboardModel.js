const mongoose = require('mongoose');
const Product = require('../Product-Service-Model/Product');

class StockDashboardModel {
    /**
     * Get Low Stock Products
     */
    static async getLowStockProducts(filters) {
        const { userId, fromDate, toDate, branchId, limit = 10 } = filters;

        const match = {
            userId: new mongoose.Types.ObjectId(userId),
            manageStock: true,
            $expr: { $lte: ['$qty', '$lowStockAlert'] }
        };

        if (fromDate || toDate) {
            match.createdAt = {};
            if (fromDate) match.createdAt.$gte = new Date(fromDate);
            if (toDate) match.createdAt.$lte = new Date(toDate);
        }

        if (branchId) {
            match.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const query = Product.find(match)
            .select('name qty lowStockAlert unit')
            .sort({ qty: 1 })
            .limit(parseInt(limit))
            .lean();

        const data = await query;
        const count = await Product.countDocuments(match);

        return { data, count };
    }
}

module.exports = StockDashboardModel;
