const SalesSummaryModel = require('../../models/Dashboard-Model/SalesSummaryModel');
const { getCacheManager } = require('../../utils/cacheManager');

class SalesSummaryController {
    /**
     * GET /api/dashboard/sales-summary
     */
    static async getSalesSummary(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:sales-summary', filters, req.user._id);

            let summary = null;
            if (!isRefresh) {
                summary = await cacheManager.get(cacheKey);
            }

            if (!summary) {
                summary = await SalesSummaryModel.getSummary(filters);
                await cacheManager.set(cacheKey, summary, 300000); // 5 minutes cache
            }

            // Fetch user for logo and verification status
            const user = await require('../../models/User-Model/User').findById(req.user._id).select('businessLogo isEmailVerified').lean();

            const dashboardOptions = [];
            if (user && !user.isEmailVerified) {
                dashboardOptions.push('Verify Email');
            }

            res.status(200).json({
                success: true,
                data: {
                    ...summary,
                    businessLogo: user ? user.businessLogo : '',
                    dashboardOptions
                }
            });
        } catch (error) {
            console.error('SalesSummaryController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = SalesSummaryController;
