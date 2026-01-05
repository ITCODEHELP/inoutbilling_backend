const mongoose = require('mongoose');

const creditPaymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    packId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreditPack', required: true },
    packName: { type: String, required: true },
    amount: { type: Number, required: true },
    transactionId: { type: String, required: true },
    paymentType: { type: String, required: true }, // 'ONLINE', 'CASH', etc.
    paymentDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['SUCCESS', 'FAILED', 'PENDING'], default: 'SUCCESS' }
}, { timestamps: true });

module.exports = mongoose.model('CreditPayment', creditPaymentSchema);
