const mongoose = require('mongoose');

const creditUsageLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
    action: { type: String, required: true }, // e.g., 'E-Way Bill Generate'
    description: { type: String },
    credits: { type: Number, required: true },
    balanceAfter: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('CreditUsageLog', creditUsageLogSchema);
