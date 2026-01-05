const Product = require('../models/Product');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const DailyExpense = require('../models/DailyExpense');
const Letter = require('../models/Letter');

// @desc    Search documents by reference type and optional date range
// @route   GET /api/go-drive/search
// @access  Private
const searchDocuments = async (req, res) => {
    const { referenceType, fromDate, toDate, searchAll } = req.query;

    if (!referenceType) {
        return res.status(400).json({
            success: false,
            message: 'Reference Type is required',
            data: null
        });
    }

    const validTypes = ['product', 'purchase_invoice', 'daily_expense', 'letter'];
    if (!validTypes.includes(referenceType)) {
        return res.status(400).json({
            success: false,
            message: `Invalid Reference Type. Must be one of: ${validTypes.join(', ')}`,
            data: null
        });
    }

    try {
        let query = { userId: req.user._id };
        let dateFilter = {};

        // Handle Date Range
        if (searchAll !== 'true' && fromDate && toDate) {
            const start = new Date(fromDate);
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999); // Set to end of day

            if (isNaN(start) || isNaN(end)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Use YYYY-MM-DD',
                    data: null
                });
            }

            dateFilter = { $gte: start, $lte: end };
        }

        let results = [];

        switch (referenceType) {
            case 'product':
                if (Object.keys(dateFilter).length > 0) {
                    query.createdAt = dateFilter;
                }
                results = await Product.find(query).sort({ createdAt: -1 });
                break;

            case 'purchase_invoice':
                if (Object.keys(dateFilter).length > 0) {
                    query['invoiceDetails.date'] = dateFilter;
                }
                results = await PurchaseInvoice.find(query).sort({ 'invoiceDetails.date': -1 });
                break;

            case 'daily_expense':
                if (Object.keys(dateFilter).length > 0) {
                    query.expenseDate = dateFilter;
                }
                results = await DailyExpense.find(query).sort({ expenseDate: -1 });
                break;

            case 'letter':
                if (Object.keys(dateFilter).length > 0) {
                    query.letterDate = dateFilter;
                }
                results = await Letter.find(query).sort({ letterDate: -1 });
                break;
        }

        res.status(200).json({
            success: true,
            message: `${referenceType.replace('_', ' ')} records fetched successfully`,
            total: results.length,
            data: results
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

module.exports = {
    searchDocuments
};
