const PartyInsightsModel = require('../../models/Dashboard-Model/PartyInsightsModel');
const { getCacheManager } = require('../../utils/cacheManager');

class PartyInsightsController {
    /**
     * GET /api/dashboard/top-parties
     */
    static async getTopParties(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:top-parties', filters, req.user._id);

            let result = null;
            if (!isRefresh) {
                result = await cacheManager.get(cacheKey);
            }

            if (!result) {
                const [topCustomers, topVendors] = await Promise.all([
                    PartyInsightsModel.getTopCustomers(filters),
                    PartyInsightsModel.getTopVendors(filters)
                ]);
                result = { topCustomers, topVendors };
                await cacheManager.set(cacheKey, result, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('PartyInsightsController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = PartyInsightsController;
