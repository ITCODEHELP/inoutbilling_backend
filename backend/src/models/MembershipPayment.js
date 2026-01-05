const mongoose = require('mongoose');

const membershipPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    paymentFor: { type: String, required: true }, // Plan Name
    paymentDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true },
    paymentType: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('MembershipPayment', membershipPaymentSchema);
