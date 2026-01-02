const mongoose = require('mongoose');

const barcodeCustomizationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Product ID is required']
    },
    noOfLabels: {
        type: Number,
        required: [true, 'Number of labels is required']
    },
    customizationName: {
        type: String,
        required: [true, 'Customization Name is required'],
        trim: true
    },
    header: { type: String },
    line1: { type: String },
    line2: { type: String },
    printer: { type: String },
    size: { type: String },
    conversionRatio: { type: Number },
    pageWidth: { type: Number },
    barcodesPerLine: { type: Number },
    rowsPerPage: { type: Number },
    barcodeWidth: { type: Number },
    barcodeHeight: { type: Number },
    horizontalGap: { type: Number },
    verticalGap: { type: Number },
    pageMarginLR: { type: Number }, // Left/Right Margin
    pageMarginTB: { type: Number }, // Top/Bottom Margin
    spaceInsideBarcode: { type: Number },
    headerLineHeight: { type: Number },
    lineTextHeight: { type: Number },
    barcodeFontSize: { type: Number },
    headerFontSize: { type: Number },
    barHeight: { type: Number },
    barWidth: { type: Number },
    showBorder: { type: Boolean, default: false },
    hideBarcodeNumber: { type: Boolean, default: false },
    hideBarcodeValue: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Compound index to ensure unique customization names per user
barcodeCustomizationSchema.index({ userId: 1, customizationName: 1 }, { unique: true });

module.exports = mongoose.model('BarcodeCustomization', barcodeCustomizationSchema);
