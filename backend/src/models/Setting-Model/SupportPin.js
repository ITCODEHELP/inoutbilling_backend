const mongoose = require('mongoose');

const supportPinSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // One active PIN per user
        index: true
    },
    pin: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 } // Use TTL index to auto-delete after expiresAt
    }
}, {
    timestamps: true,
    collection: 'support_pins'
});

module.exports = mongoose.model('SupportPin', supportPinSchema);
