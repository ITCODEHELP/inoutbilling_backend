const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema({
    referrer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    referredUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    signupDate: {
        type: Date,
        default: Date.now
    },
    accountType: {
        type: String,
        enum: ['FREE', 'PREMIUM'],
        default: 'FREE'
    }
}, {
    timestamps: true,
    collection: 'referrals'
});

// Calculate metrics easily
referralSchema.statics.getStatsForUser = async function (userId) {
    const total = await this.countDocuments({ referrer: userId });
    const premium = await this.countDocuments({ referrer: userId, accountType: 'PREMIUM' });
    return { total, premium };
};

module.exports = mongoose.model('Referral', referralSchema);
