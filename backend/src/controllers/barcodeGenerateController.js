const Product = require('../models/Product');
const BarcodeCart = require('../models/BarcodeCart');
const BarcodeHistory = require('../models/BarcodeHistory');

// @desc    Add product to barcode generate list
// @route   POST /api/barcode-generate/cart
// @access  Private
const addToBarcodeCart = async (req, res) => {
    try {
        const { productId, noOfLabels } = req.body;

        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        if (!noOfLabels || noOfLabels <= 0) {
            return res.status(400).json({ message: 'Number of labels must be greater than 0' });
        }

        const product = await Product.findOne({ _id: productId, userId: req.user._id });
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        // Check if already in cart
        let cartItem = await BarcodeCart.findOne({ productId, userId: req.user._id });

        if (cartItem) {
            cartItem.noOfLabels = noOfLabels;
            await cartItem.save();
        } else {
            cartItem = await BarcodeCart.create({
                userId: req.user._id,
                productId,
                productName: product.name,
                noOfLabels
            });
        }

        res.status(200).json(cartItem);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get barcode generate list
// @route   GET /api/barcode-generate/cart
// @access  Private
const getBarcodeCart = async (req, res) => {
    try {
        const cartItems = await BarcodeCart.find({ userId: req.user._id });
        res.status(200).json(cartItems);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Remove product from barcode generate list
// @route   DELETE /api/barcode-generate/cart/:id
// @access  Private
const removeFromBarcodeCart = async (req, res) => {
    try {
        const cartItem = await BarcodeCart.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!cartItem) {
            return res.status(404).json({ message: 'Item not found in list' });
        }

        res.status(200).json({ message: 'Product removed from list' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Generate barcodes for all products in list
// @route   POST /api/barcode-generate/generate
// @access  Private
const generateBarcodes = async (req, res) => {
    try {
        const cartItems = await BarcodeCart.find({ userId: req.user._id });

        if (cartItems.length === 0) {
            return res.status(400).json({ message: 'Generate list is empty' });
        }

        const items = [];

        for (const item of cartItems) {
            // Logic to generate unique barcode numbers
            // If the product already has a barcode, we use it or generate new ones?
            // "Generate Barcode Number" usually implies creating new ones.
            // Requirement says "create unique barcode numbers".

            const generatedBarcodes = [];
            for (let i = 0; i < item.noOfLabels; i++) {
                // simple generation logic: Timestamp + Random suffix or Product ID based
                const uniqueCode = `${Date.now()}${Math.floor(Math.random() * 1000)}${i}`;
                generatedBarcodes.push(uniqueCode);
            }

            items.push({
                productId: item.productId,
                productName: item.productName,
                noOfLabels: item.noOfLabels,
                generatedBarcodes
            });
        }

        const history = await BarcodeHistory.create({
            userId: req.user._id,
            items,
            generatedAt: new Date()
        });

        // Clear the cart
        await BarcodeCart.deleteMany({ userId: req.user._id });

        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get barcode generation history
// @route   GET /api/barcode-generate/history
// @access  Private
const getBarcodeHistory = async (req, res) => {
    try {
        const history = await BarcodeHistory.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    addToBarcodeCart,
    getBarcodeCart,
    removeFromBarcodeCart,
    generateBarcodes,
    getBarcodeHistory
};
