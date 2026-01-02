const Product = require('../models/Product');

/**
 * @desc    Get count of products based on filters
 * @route   GET /api/products/search-counts
 * @access  Private
 */
const getProductSearchCounts = async (req, res) => {
    try {
        const { productName, productNote, hsnCode, productGroup, stockType } = req.query;

        // Build query object
        const query = { userId: req.user._id };

        // Helper for partial match regex
        const regex = (val) => new RegExp(val, 'i');

        if (productName) query.name = regex(productName);
        if (productNote) query.productNote = regex(productNote);
        if (hsnCode) query.hsnSac = regex(hsnCode);
        if (productGroup) query.productGroup = regex(productGroup);
        if (stockType) query.stockType = regex(stockType);

        // Aggregation to get all counts in one DB trip
        const counts = await Product.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    productCount: {
                        $sum: { $cond: [{ $eq: ["$itemType", "Product"] }, 1, 0] }
                    },
                    serviceCount: {
                        $sum: { $cond: [{ $eq: ["$itemType", "Service"] }, 1, 0] }
                    }
                }
            }
        ]);

        const result = counts.length > 0 ? counts[0] : { totalCount: 0, productCount: 0, serviceCount: 0 };

        // Remove _id from result before sending
        delete result._id;

        res.status(200).json(result);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = { getProductSearchCounts };
