const ProductInsightsModel = require('../../models/Dashboard-Model/ProductInsightsModel');
const { getCacheManager } = require('../../utils/cacheManager');

class ProductInsightsController {
    /**
     * GET /api/dashboard/top-products
     */
    static async getTopProducts(req, res) {
        try {
            const { fromDate, toDate, branchId, limit, refresh } = req.query;
            const isRefresh = refresh === 'true' || req.headers['x-refresh'] === 'true';

            const filters = {
                userId: req.user._id,
                fromDate,
                toDate,
                branchId,
                limit: limit || 10
            };

            const cacheManager = getCacheManager();
            const cacheKey = cacheManager.generateKey('dashboard:top-products', filters, req.user._id);

            let topProducts = null;
            if (!isRefresh) {
                topProducts = await cacheManager.get(cacheKey);
            }

            if (!topProducts) {
                topProducts = await ProductInsightsModel.getTopProducts(filters);
                await cacheManager.set(cacheKey, topProducts, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data: topProducts
            });
        } catch (error) {
            console.error('ProductInsightsController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }

    /**
     * GET /api/dashboard/least-selling
     */
    static async getLeastProducts(req, res) {
        try {
            const { fromDate, toDate, branchId, limit, refresh } = req.query;
            const isRefresh = refresh === 'true' || req.headers['x-refresh'] === 'true';

            const filters = {
                userId: req.user._id,
                fromDate,
                toDate,
                branchId,
                limit
            };

            const cacheManager = getCacheManager();
            const cacheKey = cacheManager.generateKey('dashboard:least-selling', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await ProductInsightsModel.getLeastProducts(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                count: data.length,
                data
            });
        } catch (error) {
            console.error('ProductInsightsController LeastSelling Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
}

module.exports = ProductInsightsController;
