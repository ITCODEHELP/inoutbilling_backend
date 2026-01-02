const Product = require('../models/Product');

// @desc    Get Products for Manage Stock with Filters
// @route   GET /api/products/manage-stock
// @access  Private
const getManageStock = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            productGroup,
            stockMin,
            stockMax,
            stockStatus
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        let query = { userId: req.user._id, itemType: 'Product', manageStock: true };

        // 1. Partial Search on Name (Case-insensitive)
        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        // 2. Product Group (Case-insensitive Regex)
        if (productGroup) {
            query.productGroup = { $regex: productGroup, $options: 'i' };
        }

        // 3. Stock Range (Min/Max)
        if (stockMin !== undefined || stockMax !== undefined) {
            query.qty = {};
            if (stockMin !== undefined && stockMin !== '') query.qty.$gte = parseInt(stockMin);
            if (stockMax !== undefined && stockMax !== '') query.qty.$lte = parseInt(stockMax);

            // Clean up empty object if no valid min/max
            if (Object.keys(query.qty).length === 0) delete query.qty;
        }

        // 4. Stock Status Logic
        if (stockStatus) {
            if (stockStatus === 'Negative Stock') {
                query.qty = { ...query.qty, $lt: 0 };
            } else if (stockStatus === 'Out of Stock') {
                query.qty = { ...query.qty, $eq: 0 };
            } else if (stockStatus === 'In Stock') {
                // User Request: In Stock -> qty > 0
                // Note: This matches simple positive stock. If "Low Stock" is also managed in frontend filter,
                // they might overlap, but per instruction "In Stock -> qty > 0".

                // If there's existing query.qty constraint (e.g. from Range), we merge carefully.
                // However, since we used simple object for range, we can use $and if needed, 
                // but let's try to fit into query.qty if possible or use $and for safety.

                if (query.qty) {
                    query.qty.$gt = 0; // Overwrites $gte if present? No, keys match.
                    // If user set stockMin=5, qty must be >=5 AND >0. Fine.
                    // If user set stockMax=-5 (impossible with In Stock), logic might return empty.
                } else {
                    query.qty = { $gt: 0 };
                }
            } else if (stockStatus === 'Low Stock') {
                // Low Stock: 0 < Qty <= LowStockAlert
                // This requires field comparison.
                query.$and = query.$and || [];
                query.$and.push(
                    { qty: { $gt: 0 } },
                    { $expr: { $lte: ["$qty", "$lowStockAlert"] } }
                );
            }
        }

        const products = await Product.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Product.countDocuments(query);

        // Map to requested structure
        const formattedProducts = products.map(p => ({
            _id: p._id,
            name: p.name,
            productGroup: p.productGroup || '-',
            purchasePrice: p.purchasePrice,
            sellPrice: p.sellPrice,
            hsnCode: p.hsnSac || '-',
            currentStock: p.qty,
            changeInStock: 0, // Default 0 for editable field
            finalStock: p.qty, // currentStock + changeInStock
            remarks: ''
        }));

        res.status(200).json({
            data: formattedProducts,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};


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
    getProductStats,
    getManageStock
};
