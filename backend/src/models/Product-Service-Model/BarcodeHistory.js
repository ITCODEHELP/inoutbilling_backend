const mongoose = require('mongoose');

const barcodeHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        productName: {
            type: String,
            required: true
        },
        noOfLabels: {
            type: Number,
            required: true
        },
        generatedBarcodes: [{
            type: String
        }]
    }],
    generatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('BarcodeHistory', barcodeHistorySchema);
