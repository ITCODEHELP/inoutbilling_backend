const mongoose = require('mongoose');

const digitalSignatureSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    certificatePassword: {
        type: String, // Should be stored securely/encrypted
        required: true
    },
    isEnabled: {
        type: Boolean,
        default: false
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DigitalSignature', digitalSignatureSchema);
