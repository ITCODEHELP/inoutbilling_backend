const mongoose = require('mongoose');

const staffSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    activeHours: {
        type: String,
        default: ''
    },
    allowedSections: {
        type: [String],
        default: []
    },
    ownerUserId: {
        type: String,
        required: true,
        index: true
    },
    ownerRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Staff', staffSchema);
