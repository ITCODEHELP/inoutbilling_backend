const mongoose = require('mongoose');

const bulkEditLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    filename: { type: String, required: true },
    totalRecords: { type: Number, required: true },
    successCount: { type: Number, required: true },
    duplicateCount: { type: Number, required: true },
    invalidCount: { type: Number, required: true },
    details: [{
        recordNumber: Number,
        status: { type: String, enum: ['Success', 'Duplicate', 'Invalid'] },
        action: String,
        details: mongoose.Schema.Types.Mixed
    }]
}, { timestamps: true });

module.exports = mongoose.model('BulkEditLog', bulkEditLogSchema);
