const mongoose = require('mongoose');

const paymentReminderSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Simple boolean flags
    email_reminder_enabled: { type: Boolean, default: false },
    whatsapp_reminder_enabled: { type: Boolean, default: false }
}, {
    timestamps: true
});

module.exports = mongoose.model('PaymentReminderSettings', paymentReminderSettingsSchema);
