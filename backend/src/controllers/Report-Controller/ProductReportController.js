const ProductReportModel = require('../../models/Report-Model/ProductReportModel');

class ProductReportController {
    static async searchProducts(req, res) {
        try {
            const {
                productName,
                productGroup,
                fromDate,
                toDate,
                showStockAdjustedOnly,
                groupRecordByProduct
            } = req.body;

            const { page, limit } = req.query;

            const filters = {
                userId: req.user._id, // Assumes auth middleware populates req.user
                productName,
                productGroup,
                fromDate,
                toDate,
                showStockAdjustedOnly,
                groupRecordByProduct
            };

            const options = {
                page,
                limit
            };

            const result = await ProductReportModel.getProductReport(filters, options);

            if (!result.success) {
                return res.status(500).json(result);
            }

            res.status(200).json(result);

        } catch (error) {
            console.error('ProductReportController Error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: error.message
            });
        }
    }
}

module.exports = ProductReportController;
