const mongoose = require('mongoose');

const productCustomColumnSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customFieldName: {
        type: String,
        required: [true, 'Custom Field Name is required']
    },
    status: {
        type: String,
        enum: ['Enabled', 'Disabled', 'enabled', 'disabled'],
        default: 'Enabled'
    },
    print: {
        type: Boolean,
        default: false
    },
    numericFormat: {
        type: String,
        default: 'None'
    },
    defaultValue: {
        type: String,
        default: ''
    },
    position: {
        type: String,
        default: ''
    },
    decimalValue: {
        type: Number,
        default: 0
    },
    enableCalculation: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Ensure unique customFieldName per user
productCustomColumnSchema.index({ userId: 1, customFieldName: 1 }, { unique: true });

module.exports = mongoose.model('ProductCustomColumn', productCustomColumnSchema);
