const mongoose = require('mongoose');

const purchaseOrderCustomFieldSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['Text', 'Number', 'Date', 'Dropdown'],
        required: true
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    print: {
        type: Boolean,
        default: true
    },
    required: {
        type: Boolean,
        default: false
    },
    options: [String], // For dropdown type
    orderNo: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index to ensure unique field name per user
purchaseOrderCustomFieldSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrderCustomField', purchaseOrderCustomFieldSchema);
