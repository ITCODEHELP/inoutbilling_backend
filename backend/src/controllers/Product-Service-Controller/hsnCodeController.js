const Product = require('../../models/Product-Service-Model/Product');

// @desc    Get unique HSN codes from products
// @route   GET /api/hsn-codes
// @access  Private
const getHSNCodes = async (req, res) => {
    try {
        const userId = req.user._id;
        const { search } = req.query;

        // Build query
        const query = { userId };
        
        // Add search filter if provided
        if (search) {
            query.hsnSac = { $regex: search, $options: 'i' };
        }

        // Get unique HSN codes from products
        const hsnCodes = await Product.aggregate([
            { $match: query },
            { $match: { hsnSac: { $exists: true, $ne: '' } } },
            {
                $group: {
                    _id: '$hsnSac',
                    count: { $sum: 1 },
                    products: { $push: { name: '$name', id: '$_id' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    code: '$_id',
                    count: 1,
                    products: { $slice: ['$products', 5] } // Limit to 5 products per HSN
                }
            },
            { $sort: { count: -1 } },
            { $limit: 50 }
        ]);

        res.status(200).json({
            success: true,
            count: hsnCodes.length,
            data: hsnCodes
        });
    } catch (error) {
        console.error('Error fetching HSN codes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching HSN codes',
            error: error.message
        });
    }
};

// @desc    Get HSN code suggestions based on search
// @route   GET /api/hsn-codes/suggestions
// @access  Private
const getHSNSuggestions = async (req, res) => {
    try {
        const userId = req.user._id;
        const { search } = req.query;

        if (!search || search.length < 2) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        // Search for HSN codes with full product information
        const suggestions = await Product.aggregate([
            {
                $match: {
                    userId,
                    hsnSac: { $regex: search, $options: 'i' }
                }
            },
            {
                $group: {
                    _id: '$hsnSac',
                    productCount: { $sum: 1 },
                    // Get the first product's details as default
                    sampleProduct: { $first: '$name' },
                    productId: { $first: '$_id' },
                    productName: { $first: '$name' },
                    sellingPrice: { $first: '$sellPrice' },
                    purchasePrice: { $first: '$purchasePrice' },
                    uom: { $first: '$unitOfMeasurement' },
                    taxRate: { $first: '$taxSelection' },
                    cessPercent: { $first: '$cessPercent' },
                    cessAmount: { $first: '$cessAmount' },
                    currentStock: { $first: '$availableQuantity' },
                    description: { $first: '$productNote' }
                }
            },
            {
                $project: {
                    _id: 0,
                    code: '$_id',
                    productCount: 1,
                    sampleProduct: 1,
                    productId: 1,
                    productName: 1,
                    sellingPrice: 1,
                    purchasePrice: 1,
                    uom: 1,
                    taxRate: 1,
                    cessPercent: 1,
                    cessAmount: 1,
                    currentStock: 1,
                    description: 1
                }
            },
            { $sort: { productCount: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error('Error fetching HSN suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching HSN suggestions',
            error: error.message
        });
    }
};

// @desc    Get HSN code statistics
// @route   GET /api/hsn-codes/stats
// @access  Private
const getHSNStats = async (req, res) => {
    try {
        const userId = req.user._id;

        const stats = await Product.aggregate([
            { $match: { userId } },
            {
                $group: {
                    _id: null,
                    totalProducts: { $sum: 1 },
                    productsWithHSN: {
                        $sum: {
                            $cond: [
                                { $and: [{ $ne: ['$hsnSac', ''] }, { $ne: ['$hsnSac', null] }] },
                                1,
                                0
                            ]
                        }
                    },
                    uniqueHSNCodes: { $addToSet: '$hsnSac' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalProducts: 1,
                    productsWithHSN: 1,
                    productsWithoutHSN: { $subtract: ['$totalProducts', '$productsWithHSN'] },
                    uniqueHSNCount: { $size: '$uniqueHSNCodes' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: stats[0] || {
                totalProducts: 0,
                productsWithHSN: 0,
                productsWithoutHSN: 0,
                uniqueHSNCount: 0
            }
        });
    } catch (error) {
        console.error('Error fetching HSN stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching HSN statistics',
            error: error.message
        });
    }
};

module.exports = {
    getHSNCodes,
    getHSNSuggestions,
    getHSNStats
};
