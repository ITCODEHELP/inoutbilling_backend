const mongoose = require('mongoose');

const saleOrderCustomFieldSchema = new mongoose.Schema({
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
        default: 'Text'
    },
    options: [String], // For dropdown
    required: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    orderNo: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SaleOrderCustomField', saleOrderCustomFieldSchema);
