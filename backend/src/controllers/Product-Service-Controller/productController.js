const Product = require('../../models/Product-Service-Model/Product');
const { recordActivity } = require('../../utils/activityLogHelper');

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
        let query = { userId: req.user._id, itemType: 'Product', status: { $ne: 'Deleted' } };

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
            query.availableQuantity = {};
            if (stockMin !== undefined && stockMin !== '') query.availableQuantity.$gte = parseInt(stockMin);
            if (stockMax !== undefined && stockMax !== '') query.availableQuantity.$lte = parseInt(stockMax);

            // Clean up empty object if no valid min/max
            if (Object.keys(query.availableQuantity).length === 0) delete query.availableQuantity;
        }

        // 4. Stock Status Logic
        if (stockStatus) {
            if (stockStatus === 'Negative Stock') {
                query.availableQuantity = { ...query.availableQuantity, $lt: 0 };
            } else if (stockStatus === 'Out of Stock') {
                query.availableQuantity = { ...query.availableQuantity, $eq: 0 };
            } else if (stockStatus === 'In Stock') {
                if (query.availableQuantity) {
                    query.availableQuantity.$gt = 0;
                } else {
                    query.availableQuantity = { $gt: 0 };
                }
            } else if (stockStatus === 'Low Stock') {
                // Low Stock: 0 < AvailableQuantity <= LowStockAlert
                query.$and = query.$and || [];
                query.$and.push(
                    { availableQuantity: { $gt: 0 } },
                    { $expr: { $lte: ["$availableQuantity", "$lowStockAlert"] } }
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
            currentStock: p.availableQuantity,
            changeInStock: 0,
            finalStock: p.availableQuantity,
            remarks: '',
            inventoryType: p.inventoryType
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
            { $match: { userId: req.user._id, status: { $ne: 'Deleted' } } },
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
        const body = { ...req.body };

        // Handle images
        if (req.files && req.files.length > 0) {
            body.images = req.files.map(file => ({
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype
            }));
        }

        // Exclude Batch/Serial data for Services
        if (body.itemType === 'Service') {
            delete body.batchData;
            delete body.serialData;
            delete body.inventoryType; // Services are usually not inventory tracked in this specific way
        }

        // Parse numeric fields if they come as strings
        const numericFields = [
            'taxSelection', 'cessPercent', 'cessAmount', 'availableQuantity',
            'sellPrice', 'purchasePrice', 'lowStockAlert'
        ];
        numericFields.forEach(field => {
            if (body[field]) body[field] = parseFloat(body[field]);
        });

        // Parse objects/arrays if they come as strings (for multipart form-data)
        ['saleDiscount', 'purchaseDiscount', 'batchData', 'serialData'].forEach(field => {
            if (typeof body[field] === 'string') {
                try { body[field] = JSON.parse(body[field]); } catch (e) { }
            }
        });

        const product = await Product.create({
            ...body,
            userId: req.user._id
        });

        // Activity Logging
        await recordActivity(
            req,
            'Insert',
            'Product',
            `New ${body.itemType} created: ${body.name}`,
            body.barcodeNumber || ''
        );

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
        const itemType = req.query.itemType;
        const status = req.query.status;

        let query = { userId: req.user._id };

        // Hide Deleted items from default listings
        if (status) {
            query.status = status;
        } else {
            query.status = { $ne: 'Deleted' };
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (itemType) {
            query.itemType = itemType;
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

        const body = { ...req.body };

        // Handle images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => ({
                fileName: file.filename,
                filePath: file.path,
                fileSize: file.size,
                mimeType: file.mimetype
            }));
            // Decision: Append or Replace? Usually for product edit, user might want to keep existing.
            // But if they send new ones, maybe they are managing the whole list.
            // Let's assume replacement if 'images' is not in body, or update based on logic.
            // Simplest: replace if images are uploaded.
            body.images = newImages;
        }

        if (body.itemType === 'Service') {
            body.batchData = [];
            body.serialData = null;
            body.inventoryType = 'Normal';
        }

        // Parse numeric fields if they come as strings
        const numericFields = [
            'taxSelection', 'cessPercent', 'cessAmount', 'availableQuantity',
            'sellPrice', 'purchasePrice', 'lowStockAlert'
        ];
        numericFields.forEach(field => {
            if (body[field]) body[field] = parseFloat(body[field]);
        });

        // Parse objects/arrays if they come as strings
        ['saleDiscount', 'purchaseDiscount', 'batchData', 'serialData'].forEach(field => {
            if (typeof body[field] === 'string') {
                try { body[field] = JSON.parse(body[field]); } catch (e) { }
            }
        });

        const updatedProduct = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: body },
            { new: true, runValidators: true }
        );

        // Activity Logging
        await recordActivity(
            req,
            'Update',
            'Product',
            `Product updated: ${updatedProduct.name}`,
            updatedProduct.barcodeNumber || ''
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
        const product = await Product.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        product.status = 'Deleted';
        await product.save();

        // Activity Logging
        await recordActivity(
            req,
            'Delete',
            'Product',
            `Product deleted: ${product.name}`,
            product.barcodeNumber || ''
        );

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Cancel Product/Service
// @route   POST /api/products/:id/cancel
// @access  Private
const cancelProduct = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.status === 'Deleted') {
            return res.status(400).json({ message: 'Deleted products cannot be cancelled.' });
        }

        product.status = 'Cancelled';
        await product.save();

        // Activity Logging
        await recordActivity(
            req,
            'Update',
            'Product',
            `Product cancelled: ${product.name}`,
            product.barcodeNumber || ''
        );

        res.status(200).json(product);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Restore Product/Service
// @route   POST /api/products/:id/restore
// @access  Private
const restoreProduct = async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.status === 'Deleted') {
            return res.status(400).json({ message: 'Deleted products cannot be restored (Reactivation not allowed).' });
        }

        product.status = 'Active';
        await product.save();

        // Activity Logging
        await recordActivity(
            req,
            'Update',
            'Product',
            `Product restored: ${product.name}`,
            product.barcodeNumber || ''
        );

        res.status(200).json(product);
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
    getManageStock,
    cancelProduct,
    restoreProduct
};
