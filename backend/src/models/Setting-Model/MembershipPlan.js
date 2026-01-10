const mongoose = require('mongoose');

const membershipPlanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    durationYears: { type: Number, required: true }, // 0 for lifetime
    price: { type: Number, required: true },
    gstPercentage: { type: Number, required: true },
    features: [String],
    limits: {
        docsPerYear: { type: Number, default: -1 },
        itemsPerDoc: { type: Number, default: -1 },
        staffAccounts: { type: Number, default: 0 }
    },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
}, { timestamps: true });

module.exports = mongoose.model('MembershipPlan', membershipPlanSchema);
