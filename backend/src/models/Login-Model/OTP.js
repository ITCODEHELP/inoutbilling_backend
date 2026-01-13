const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    mobile: {
        type: String,
        required: true
    },
    otp: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        default: 'login' // login, signup, reset
    },
    expiryTime: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300 // 5 minutes TTL
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('OTP', otpSchema);
