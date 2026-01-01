const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        unique: true,
        sparse: true // Allows multiple null values
    },
    userId: {
        type: String,
        unique: true,
        required: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    gstNumber: { type: String },
    companyName: { type: String },
    address: { type: String },
    pincode: { type: String },
    city: { type: String },
    state: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);
