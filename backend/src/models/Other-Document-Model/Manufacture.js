const mongoose = require('mongoose');

const manufactureItemSchema = new mongoose.Schema({
    productName: { type: String, required: [true, 'Item product name is required'], trim: true },
    itemNote: { type: String, trim: true },
    qty: { type: Number, required: [true, 'Item quantity is required'] },
    uom: { type: String, trim: true },
    price: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
});

const manufactureSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Produced product is required']
    },
    quantity: {
        type: Number,
        required: [true, 'Manufacture quantity is required']
    },
    uom: { type: String, trim: true },
    manufactureNumber: {
        type: String,
        required: [true, 'Manufacture number is required'],
        trim: true
    },
    manufactureDate: {
        type: Date,
        required: [true, 'Manufacture date is required']
    },
    rawMaterials: [manufactureItemSchema],
    otherOutcomes: [manufactureItemSchema],
    rawMaterialTotal: { type: Number, default: 0 },
    otherOutcomeTotal: { type: Number, default: 0 },
    adjustment: {
        type: { type: String, enum: ['Rs', '%'], default: 'Rs' },
        value: { type: Number, default: 0 },
        sign: { type: String, enum: ['+', '-'], default: '+' }
    },
    grandTotal: { type: Number, default: 0 },
    unitPrice: { type: Number, default: 0 },
    totalInWords: { type: String },
    documentRemarks: { type: String, trim: true },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['Active', 'Cancelled'],
        default: 'Active'
    },
    attachments: [{
        fileName: String,
        filePath: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
}, {
    timestamps: true
});

// Indexes for search
manufactureSchema.index({ userId: 1, isDeleted: 1 });
manufactureSchema.index({ manufactureNumber: 1 });

module.exports = mongoose.model('Manufacture', manufactureSchema);
