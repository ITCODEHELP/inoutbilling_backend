const SalesMapModel = require('../../models/Dashboard-Model/SalesMapModel');
const { getCacheManager } = require('../../utils/cacheManager');

class SalesMapController {
    /**
     * GET /api/dashboard/sales-map
     */
    static async getSalesMap(req, res) {
        try {
            const { fromDate, toDate, branchId, refresh } = req.query;
            const isRefresh = refresh === 'true' || req.headers['x-refresh'] === 'true';

            const filters = {
                userId: req.user._id,
                fromDate,
                toDate,
                branchId
            };

            const cacheManager = getCacheManager();
            const cacheKey = cacheManager.generateKey('dashboard:sales-map', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await SalesMapModel.getRegionalSales(filters); // Changed from getData to getRegionalSales to match original model method
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('SalesMapController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = SalesMapController;
