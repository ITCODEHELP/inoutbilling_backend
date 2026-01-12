const mongoose = require('mongoose');

const financialYearSchema = new mongoose.Schema({
    label: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    startDate: {
        type: Date,
        required: true,
        index: true
    },
    endDate: {
        type: Date,
        required: true,
        index: true
    },
    isDefault: {
        type: Boolean,
        default: false,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        index: true
    }
}, {
    timestamps: true,
    collection: 'financial_years',
    versionKey: false,
    read: 'secondaryPreferred'
});

// Optimized compound index for range queries
financialYearSchema.index({ startDate: 1, endDate: 1 });

module.exports = mongoose.model('FinancialYear', financialYearSchema);
