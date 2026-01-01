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
        required: [true, 'Product Name is required']
    },
    productNote: { type: String },
    barcode: { type: String },
    hsnSac: { type: String }, // HSN for Product, SAC for Service
    unit: { type: String },
    tax: {
        type: Number,
        required: [true, 'Tax Rate is required']
    },
    cessPercent: { type: Number, default: 0 },
    cessAmount: { type: Number, default: 0 },
    itcType: { type: String }, // e.g., Eligible, Ineligible

    // Inventory
    manageStock: { type: Boolean, default: false },
    stockType: { type: String }, // e.g., Opening, Current
    qty: { type: Number, default: 0 }, // Current Quantity
    lowStockAlert: { type: Number, default: 0 },

    // Pricing
    sellPrice: { type: Number, default: 0 },
    sellPriceInclTax: { type: Number, default: false },
    saleDiscount: {
        value: { type: Number, default: 0 },
        type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
    },

    purchasePrice: { type: Number, default: 0 },
    purchasePriceInclTax: { type: Number, default: false },
    purchaseDiscount: {
        value: { type: Number, default: 0 },
        type: { type: String, enum: ['Percentage', 'Flat'], default: 'Percentage' }
    },

    // Additional
    productGroup: { type: String },
    additionalDetails: { type: mongoose.Schema.Types.Mixed },
    images: [{ type: String }], // URL or Base64

    // Flags
    manufactureFlag: { type: Boolean, default: false },
    nonSellableFlag: { type: Boolean, default: false }

}, {
    timestamps: true
});

// Indexes for search
productSchema.index({ name: 'text', productGroup: 'text' });

module.exports = mongoose.model('Product', productSchema);
