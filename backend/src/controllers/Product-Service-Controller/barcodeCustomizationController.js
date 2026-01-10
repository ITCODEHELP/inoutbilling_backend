const BarcodeCustomization = require('../../models/Product-Service-Model/BarcodeCustomization');

// @desc    Create new Barcode Customization
// @route   POST /api/barcode/customization
// @access  Private
const createCustomization = async (req, res) => {
    try {
        const {
            productId,
            noOfLabels,
            customizationName,
            header,
            line1,
            line2,
            printer,
            size,
            conversionRatio,
            pageWidth,
            barcodesPerLine,
            rowsPerPage,
            barcodeWidth,
            barcodeHeight,
            horizontalGap,
            verticalGap,
            pageMarginLR,
            pageMarginTB,
            spaceInsideBarcode,
            headerLineHeight,
            lineTextHeight,
            barcodeFontSize,
            headerFontSize,
            barHeight,
            barWidth,
            showBorder,
            hideBarcodeNumber,
            hideBarcodeValue
        } = req.body;

        // Check duplicates for this user
        const existing = await BarcodeCustomization.findOne({
            userId: req.user._id,
            customizationName: customizationName
        });

        if (existing) {
            return res.status(400).json({ message: 'Customization Name with this name already exists' });
        }

        const customization = await BarcodeCustomization.create({
            userId: req.user._id,
            productId,
            noOfLabels,
            customizationName,
            header,
            line1,
            line2,
            printer,
            size,
            conversionRatio,
            pageWidth,
            barcodesPerLine,
            rowsPerPage,
            barcodeWidth,
            barcodeHeight,
            horizontalGap,
            verticalGap,
            pageMarginLR,
            pageMarginTB,
            spaceInsideBarcode,
            headerLineHeight,
            lineTextHeight,
            barcodeFontSize,
            headerFontSize,
            barHeight,
            barWidth,
            showBorder,
            hideBarcodeNumber,
            hideBarcodeValue
        });

        res.status(201).json(customization);

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Barcode Customizations
// @route   GET /api/barcode/customization
// @access  Private
const getCustomizations = async (req, res) => {
    try {
        const customizations = await BarcodeCustomization.find({ userId: req.user._id })
            .populate('productId', 'name') // Populate product name if needed
            .sort({ createdAt: -1 });
        res.status(200).json(customizations);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get single Barcode Customization
// @route   GET /api/barcode/customization/:id
// @access  Private
const getCustomizationById = async (req, res) => {
    try {
        const customization = await BarcodeCustomization.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('productId', 'name');

        if (!customization) {
            return res.status(404).json({ message: 'Customization not found' });
        }

        res.status(200).json(customization);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update Barcode Customization
// @route   PUT /api/barcode/customization/:id
// @access  Private
const updateCustomization = async (req, res) => {
    try {
        const customization = await BarcodeCustomization.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!customization) {
            return res.status(404).json({ message: 'Customization not found' });
        }

        // Check duplicate name if name is being changed
        if (req.body.customizationName && req.body.customizationName !== customization.customizationName) {
            const existing = await BarcodeCustomization.findOne({
                userId: req.user._id,
                customizationName: req.body.customizationName
            });
            if (existing) {
                return res.status(400).json({ message: 'Customization Name with this name already exists' });
            }
        }

        const updatedCustomization = await BarcodeCustomization.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedCustomization);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete Barcode Customization
// @route   DELETE /api/barcode/customization/:id
// @access  Private
const deleteCustomization = async (req, res) => {
    try {
        const customization = await BarcodeCustomization.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!customization) {
            return res.status(404).json({ message: 'Customization not found' });
        }

        res.status(200).json({ message: 'Customization removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createCustomization,
    getCustomizations,
    getCustomizationById,
    updateCustomization,
    deleteCustomization
};
