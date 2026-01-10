const mongoose = require('mongoose');

const shippingEnvelopeSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Using Mixed type to allow flexible structure (shipping_options, envelope_options, etc.)
    settings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    minimize: false // Ensure empty objects are saved
});

module.exports = mongoose.model('ShippingEnvelopeSettings', shippingEnvelopeSettingsSchema);
