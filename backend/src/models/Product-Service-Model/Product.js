const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemType: {
        type: String,
        enum: ['Product', 'Service'],
        default: 'Product'
    },
    name: {
        type: String,
        required: [true, 'Item Name is required']
    },
    productNote: { type: String },
    barcodeNumber: { type: String },
    hsnSac: { type: String }, // HSN for Product, SAC for Service
    unitOfMeasurement: { type: String },

    // Tax & Pricing
    taxSelection: {
        type: Number,
        required: [true, 'Tax Rate is required']
    },
    cessPercent: { type: Number, default: 0 },
    cessAmount: { type: Number, default: 0 },
    fixedNoItcFlag: { type: Boolean, default: false },

    // Stock Management
    inventoryType: {
        type: String,
        enum: ['Normal', 'Batch', 'Serial'],
        default: 'Normal'
    },
    availableQuantity: { type: Number, default: 0 },
    sellPrice: { type: Number, default: 0 },
    sellPriceInclTax: { type: Boolean, default: false },
    saleDiscount: {
        value: { type: Number, default: 0 },
        type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
    },
    purchasePrice: { type: Number, default: 0 },
    purchasePriceInclTax: { type: Boolean, default: false },
    purchaseDiscount: {
        value: { type: Number, default: 0 },
        type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
    },
    lowStockAlert: { type: Number, default: 0 },

    // Batch Stock Data (Only for Products with inventoryType: 'Batch')
    batchData: [{
        batchNo: { type: String },
        quantity: { type: Number, default: 0 },
        salePrice: { type: Number, default: 0 },
        salePriceInclTax: { type: Boolean, default: false },
        purchasePrice: { type: Number, default: 0 },
        purchasePriceInclTax: { type: Boolean, default: false },
        barcodeNo: { type: String },
        lowStockAlert: { type: Number, default: 0 },
        saleDiscount: {
            value: { type: Number, default: 0 },
            type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
        },
        purchaseDiscount: {
            value: { type: Number, default: 0 },
            type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
        }
    }],

    // Serial No Data (Only for Products with inventoryType: 'Serial')
    serialData: {
        serialNumbers: [{ type: String }],
        sellPrice: { type: Number, default: 0 },
        sellPriceInclTax: { type: Boolean, default: false },
        saleDiscount: {
            value: { type: Number, default: 0 },
            type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
        },
        purchasePrice: { type: Number, default: 0 },
        purchasePriceInclTax: { type: Boolean, default: false },
        purchaseDiscount: {
            value: { type: Number, default: 0 },
            type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
        },
        lowStockAlert: { type: Number, default: 0 }
    },

    // Mapping & Flags
    productGroup: { type: String },
    manufactureFlag: { type: Boolean, default: false },
    nonSellableFlag: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['Active', 'Cancelled', 'Deleted'],
        default: 'Active',
        index: true
    },

    // Images
    images: [{
        fileName: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        mimeType: { type: String }
    }]

}, {
    timestamps: true
});

// Indexes for search
productSchema.index({ name: 'text', productGroup: 'text' });

module.exports = mongoose.model('Product', productSchema);
