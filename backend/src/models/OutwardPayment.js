const mongoose = require('mongoose');

const outwardPaymentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff'
    },
    paymentNo: {
        type: String,
        required: true
    },
    paymentPrefix: {
        type: String,
        default: ''
    },
    paymentPostfix: {
        type: String,
        default: ''
    },
    companyName: {
        type: String,
        required: true
    },
    // Read-only/Derived fields stored for record keeping (snapshot)
    address: {
        type: String,
        default: ''
    },
    gstinPan: {
        type: String,
        default: ''
    },
    totalOutstanding: {
        type: Number,
        default: 0
    },
    paymentDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentType: {
        type: String,
        required: true,
        enum: ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss']
    },
    remarks: {
        type: String,
        default: ''
    },
    attachment: {
        type: String, // Path to uploaded file
        default: ''
    },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {} // Key (Definition ID) -> Value
    }
}, {
    timestamps: true
});

// Ensure paymentNo is unique per user
outwardPaymentSchema.index({ userId: 1, paymentNo: 1 }, { unique: true });

module.exports = mongoose.model('OutwardPayment', outwardPaymentSchema);
