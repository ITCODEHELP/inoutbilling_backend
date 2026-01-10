const mongoose = require('mongoose');

const dispatchAddressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    userRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    gstNumber: { type: String },
    gstAutoFill: { type: Boolean, default: false },
    companyName: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    addressLine1: {
        type: String,
        required: true
    },
    landmark: { type: String },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    pincode: {
        type: String,
        required: true
    },
    country: {
        type: String,
        default: 'India'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DispatchAddress', dispatchAddressSchema);
