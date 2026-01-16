const mongoose = require('mongoose');

/**
 * Centralized activity action list
 * (Add new actions here whenever a new feature is added)
 */
const ACTIVITY_ACTIONS = [
    'Insert',
    'Update',
    'Delete',
    'Cancel',
    'Duplicate',
    'Attach File',
    'Generate Barcode',
    'Generate E-Way Bill',
    'Download E-Way Bill JSON',
    'Convert',
    'Share Email',
    'Share WhatsApp',
    'Share SMS'
];

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
        enum: ACTIVITY_ACTIONS
    },
    module: {
        type: String,
        required: true
        /**
         * Examples:
         * - Sale Invoice
         * - Purchase Invoice
         * - Product
         * - Company
         * - Organisation Detail
         * - Delivery Challan
         */
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

/**
 * Indexes for performance & search
 */
activityLogSchema.index({ userId: 1, staffId: 1, action: 1, module: 1, createdAt: -1 });
activityLogSchema.index({ description: 'text', refNo: 'text' });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
