const mongoose = require('mongoose');

const outwardPaymentCustomFieldSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Field Name is required']
    },
    type: {
        type: String,
        enum: ['TEXT', 'DATE', 'DROPDOWN'],
        required: [true, 'Field Type is required']
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    required: {
        type: Boolean,
        default: false
    },
    print: {
        type: Boolean, // To control visibility in print views
        default: true
    },
    options: {
        type: [String], // For dropdowns
        default: []
    },
    orderNo: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OutwardPaymentCustomField', outwardPaymentCustomFieldSchema);
