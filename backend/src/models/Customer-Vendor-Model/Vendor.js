const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyName: {
        type: String,
        required: [true, 'Company Name is required']
    },
    gstin: { type: String },
    contactPerson: { type: String },
    contactNo: { type: String },
    email: { type: String },
    registrationType: { type: String },
    pan: { type: String },

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

    openingBalance: { type: Number, default: 0 },
    customerBalance: { type: Number, default: 0 },
    vendorBalance: {
        type: {
            type: String,
            enum: ["CREDIT", "DEBIT"],
            default: "CREDIT"
        }, amount: {
            type: Number,
            default: 0
        }
    },

    bankDetails: {
        bankName: String,
        ifscCode: String,
        accountNumber: String
    },

    distanceForEwayBill: { type: Number },
    creditLimit: { type: Number, default: 0 },
    dueDays: { type: Number, default: 0 },
    note: { type: String },
    enableFlag: { type: Boolean, default: true },
    isCustomerVendor: { type: Boolean, default: false }
}, {
    timestamps: true
});

// Compound index for uniqueness per user
vendorSchema.index({ userId: 1, companyName: 1 }, { unique: true });
vendorSchema.index({ userId: 1, gstin: 1 }, {
    unique: true,
    partialFilterExpression: { gstin: { $type: "string", $ne: "" } }
});

module.exports = mongoose.model('Vendor', vendorSchema);
