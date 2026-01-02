const mongoose = require('mongoose');

const importLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    filename: {
        type: String,
        required: true
    },
    totalRecords: {
        type: Number,
        required: true
    },
    successCount: {
        type: Number,
        required: true
    },
    duplicateCount: {
        type: Number,
        required: true
    },
    invalidCount: {
        type: Number,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('ImportLog', importLogSchema);
