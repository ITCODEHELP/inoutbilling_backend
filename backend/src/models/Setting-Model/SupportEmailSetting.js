const mongoose = require('mongoose');

const supportEmailSettingSchema = new mongoose.Schema({
    supportEmail: {
        type: String,
        required: true,
        default: 'support@inoutbilling.com'
    },
    expectedResponseTime: {
        type: String,
        required: true,
        default: 'within 24 hours'
    },
    subjectTemplate: {
        type: String,
        default: 'Support Request from ${userName}'
    },
    bodyTemplate: {
        type: String,
        default: 'Hi Support Team,\n\nI am ${userName} (${email}). I have the following query:\n\n'
    }
}, {
    timestamps: true,
    collection: 'support_email_settings'
});

// Static helper to get settings or create default
supportEmailSettingSchema.statics.getSettings = async function () {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

module.exports = mongoose.model('SupportEmailSetting', supportEmailSettingSchema);
