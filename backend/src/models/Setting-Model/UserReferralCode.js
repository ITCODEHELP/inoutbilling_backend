const mongoose = require('mongoose');
const crypto = require('crypto');

const userReferralCodeSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
        index: true
    },
    referralCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'user_referral_codes'
});

// Helper to generate a secure non-guessable code
userReferralCodeSchema.statics.getOrCreateCode = async function (userId) {
    let mapping = await this.findOne({ user: userId });
    if (!mapping) {
        // Generate a 10-character alphanumeric secure code
        const code = crypto.randomBytes(5).toString('hex').toUpperCase();
        mapping = await this.create({ user: userId, referralCode: code });
    }
    return mapping.referralCode;
};

module.exports = mongoose.model('UserReferralCode', userReferralCodeSchema);
