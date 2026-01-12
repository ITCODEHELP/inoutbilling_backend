const DueInvoicesModel = require('../../models/Dashboard-Model/DueInvoicesModel');
const { getCacheManager } = require('../../utils/cacheManager');

class DueInvoicesController {
    /**
     * GET /api/dashboard/due-invoices
     */
    static async getDueInvoices(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:due-invoices', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await DueInvoicesModel.getDueInvoices(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('DueInvoicesController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = DueInvoicesController;
