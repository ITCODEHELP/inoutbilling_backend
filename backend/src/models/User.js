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
    password: {
        type: String
    },
    trackLoginLocation: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    eInvoiceEnabled: {
        type: Boolean,
        default: false
    },
    ewayBillUserId: {
        type: String
    },
    ewayBillPassword: {
        type: String
    },
    displayPhone: { type: String },
    fullName: { type: String },
    pan: { type: String },
    companyType: { type: String },
    landmark: { type: String },
    additionalLicense: { type: String },
    lutNo: { type: String },
    iecNo: { type: String },
    website: { type: String },
    gstAutoFill: { type: Boolean, default: false },
    updateGstOnPreviousInvoices: { type: Boolean, default: false },
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
