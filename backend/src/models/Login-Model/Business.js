const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
    userId: {
        type: String, // String userId (e.g. GSTBILLxxxx)
        required: true,
        ref: 'User',
        index: true
    },
    haveGstin: {
        type: Boolean,
        default: false
    },
    gstin: {
        type: String,
        default: null
    },
    companyName: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        default: ''
    },
    address: {
        type: String,
        required: true
    },
    address2: {
        type: String,
        default: ''
    },
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
    gstApiData: {
        type: Object, // Store raw response from GST API if needed
        default: {}
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Business', businessSchema);
