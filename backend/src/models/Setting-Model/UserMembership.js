const mongoose = require('mongoose');

const userMembershipSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', required: true },
    membershipType: { type: String, enum: ['FREE', 'PREMIUM'], default: 'FREE' },
    expiryDate: { type: Date }, // null for lifetime
    lastPaymentDate: { type: Date },
    lastPaymentAmount: { type: Number }
}, { timestamps: true });

module.exports = mongoose.model('UserMembership', userMembershipSchema);
