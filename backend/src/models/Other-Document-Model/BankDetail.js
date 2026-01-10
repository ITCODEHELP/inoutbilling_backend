const mongoose = require('mongoose');

const bankDetailsSchema = new mongoose.Schema({
    bankId: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountName: {
        type: String,
        required: true,
        trim: true
    },
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Optional field
                return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
            },
            message: 'Invalid IFSC code format'
        }
    },
    swiftCode: {
        type: String,
        trim: true,
        uppercase: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Optional field
                return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v);
            },
            message: 'Invalid SWIFT code format'
        }
    },
    micrCode: {
        type: String,
        trim: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Optional field
                return /^[0-9]{9}$/.test(v);
            },
            message: 'Invalid MICR code format (must be 9 digits)'
        }
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    branchName: {
        type: String,
        trim: true,
        default: ''
    },
    upiId: {
        type: String,
        trim: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                if (!v) return true; // Optional field
                return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(v);
            },
            message: 'Invalid UPI ID format'
        }
    },
    printUpiQrOnInvoice: {
        type: Boolean,
        default: false
    },
    upiQrOnInvoiceWithAmount: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index for userId to allow multiple banks per user
bankDetailsSchema.index({ userId: 1 });

module.exports = mongoose.model('BankDetails', bankDetailsSchema);
