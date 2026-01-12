const InvoiceSummaryModel = require('../../models/Dashboard-Model/InvoiceSummaryModel');
const { getCacheManager } = require('../../utils/cacheManager');

class InvoiceSummaryController {
    /**
     * GET /api/dashboard/invoice-summary/counts
     */
    static async getCounts(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:invoice-counts', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await InvoiceSummaryModel.getCountSummary(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('InvoiceSummaryController getCounts Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }

    /**
     * GET /api/dashboard/invoice-summary/amounts
     */
    static async getAmounts(req, res) {
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
            const cacheKey = cacheManager.generateKey('dashboard:invoice-amounts', filters, req.user._id);

            let data = null;
            if (!isRefresh) {
                data = await cacheManager.get(cacheKey);
            }

            if (!data) {
                data = await InvoiceSummaryModel.getAmountSummary(filters);
                await cacheManager.set(cacheKey, data, 300000); // 5 minutes cache
            }

            res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('InvoiceSummaryController getAmounts Error:', error);
            res.status(500).json({ success: false, message: 'Internal Server Error' });
        }
    }
}

module.exports = InvoiceSummaryController;
