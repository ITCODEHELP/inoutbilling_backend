const mongoose = require('mongoose');

const printOptionsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // All fields are optional and stored as Mixed type for flexibility
    headerPrintSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    customerDocumentPrintSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    productItemSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    footerPrintSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    documentPrintSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    packingListPrintSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Additional flexible field for any other settings
    otherSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true,
    strict: false // Allow additional fields not defined in schema
});

module.exports = mongoose.model('PrintOptions', printOptionsSchema);
