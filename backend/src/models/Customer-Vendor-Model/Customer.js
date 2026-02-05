const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    street: { type: String },
    landmark: { type: String },
    city: { type: String }, // Required validation handled in parent
    state: { type: String }, // Required validation handled in parent
    country: { type: String }, // Required validation handled in parent
    pincode: { type: String }
});

const customerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: [true, 'Company Name is required']
    },
    companyType: { type: String },
    gstin: { type: String },
    pan: { type: String },
    contactPerson: { type: String },
    contactNo: { type: String },
    email: { type: String },
    website: { type: String },
    registrationType: { type: String },

    // Flattened primary location fields for easier validation as per request
    // or we can map them to billingAddress. 
    // The user asked to validate City, Country, State. 
    // We will enforce them in the controller or here.

    billingAddress: {
        street: String,
        landmark: String,
        city: { type: String, required: [true, 'City is required'] },
        state: { type: String, required: [true, 'State is required'] },
        country: { type: String, required: [true, 'Country is required'] },
        pincode: String
    },

    shippingAddress: {
        street: String,
        landmark: String,
        city: String,
        state: String,
        country: String,
        pincode: String
    },

    shippingAddresses: [addressSchema],

    bankDetails: {
        bankName: String,
        ifscCode: String,
        accountNumber: String
    },

    openingBalance: {
        amount: { type: Number, default: 0 },
        type: { type: String, enum: ['Credit', 'Debit', ''], default: '' } // Credit/Debit
    },

    additionalDetails: {
        distanceForEway: Number,
        dueDays: Number,
        note: String,
        customField1: String,
        customField2: String,
        customField3: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Customer', customerSchema);
