const Product = require('../models/Product');

// @desc    Get Product/Service Stats (Total, Product count, Service count)
// @route   GET /api/products/stats
// @access  Private
const getProductStats = async (req, res) => {
    try {
        const stats = await Product.aggregate([
            { $match: { userId: req.user._id } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    products: {
                        $sum: {
                            $cond: [{ $eq: ["$itemType", "Product"] }, 1, 0]
                        }
                    },
                    services: {
                        $sum: {
                            $cond: [{ $eq: ["$itemType", "Service"] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        const result = stats[0] || { total: 0, products: 0, services: 0 };
        // Remove _id from result
        delete result._id;

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Create new Product/Service
// @route   POST /api/products
// @access  Private
const createProduct = async (req, res) => {
    try {
        const {
            itemType,
            name,
            productNote,
            barcode,
            hsnSac,
            unit,
            tax,
            cessPercent,
            cessAmount,
            itcType,
            manageStock,
            stockType,
            qty,
            lowStockAlert,
            sellPrice,
            sellPriceInclTax,
            saleDiscount,
            purchasePrice,
            purchasePriceInclTax,
            purchaseDiscount,
            productGroup,
            additionalDetails,
            images,
            manufactureFlag,
            nonSellableFlag
        } = req.body;

        const product = await Product.create({
            userId: req.user._id,
            itemType,
            name,
            productNote,
            barcode,
            hsnSac,
            unit,
            tax,
            cessPercent,
            cessAmount,
            itcType,
            manageStock,
            stockType,
            qty,
            lowStockAlert,
            sellPrice,
            sellPriceInclTax,
            saleDiscount,
            purchasePrice,
            purchasePriceInclTax,
            purchaseDiscount,
            productGroup,
            additionalDetails,
            images,
            manufactureFlag,
            nonSellableFlag
        });

        res.status(201).json(product);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Products with Pagination and Search
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search;

        let query = { userId: req.user._id };

        if (search) {
            query.$text = { $search: search };
        }

        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments(query);

        res.status(200).json({
            data: products,
            pagination: {
                total,
                page,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get single Product
// @route   GET /api/products/:id
// @access  Private
const getProductById = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update Product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedProduct);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete Product
// @route   DELETE /api/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        res.status(200).json({ message: 'Product removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductStats
};
