const mongoose = require('mongoose');

const userCreditSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    totalCredits: { type: Number, default: 0 },
    usedCredits: { type: Number, default: 0 },
    remainingCredits: { type: Number, default: 0 },
    packName: { type: String, default: 'Trial Pack' }
}, { timestamps: true });

// Auto-calculate remaining credits before saving
userCreditSchema.pre('save', function (next) {
    this.remainingCredits = this.totalCredits - this.usedCredits;
    next();
});

module.exports = mongoose.model('UserCredit', userCreditSchema);
