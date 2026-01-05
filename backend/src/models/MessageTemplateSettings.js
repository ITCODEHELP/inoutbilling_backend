const mongoose = require('mongoose');

const messageTemplateSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Using Mixed type to allow flexible structure for various document types
    // Structure expected: { "Sales Invoice": { email: {..}, whatsapp: {..} }, ... }
    templates: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    minimize: false // Ensure empty objects are saved
});

module.exports = mongoose.model('MessageTemplateSettings', messageTemplateSettingsSchema);
