const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    device: {
        type: String,
        required: true
    },
    browser: {
        type: String,
        required: true
    },
    platform: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    location: {
        type: String,
        default: 'Location tracked off'
    },
    loginTime: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('LoginHistory', loginHistorySchema);
