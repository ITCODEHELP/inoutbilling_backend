const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    letterDate: {
        type: Date,
        required: true
    },
    subject: {
        type: String,
        required: true
    },
    recipientName: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    letterType: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Letter', letterSchema);
