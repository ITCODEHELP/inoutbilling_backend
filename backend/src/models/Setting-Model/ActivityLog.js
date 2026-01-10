const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    action: {
        type: String,
        required: true,
        enum: ['Insert', 'Update', 'Delete']
    },
    module: {
        type: String,
        required: true,
        // Existing modules: Organisation Detail, Product, Purchase Invoice, Company, etc.
    },
    refNo: {
        type: String,
        default: ''
    },
    description: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for search optimization
activityLogSchema.index({ userId: 1, staffId: 1, action: 1, module: 1, timestamp: -1 });
activityLogSchema.index({ description: 'text', refNo: 'text' });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
