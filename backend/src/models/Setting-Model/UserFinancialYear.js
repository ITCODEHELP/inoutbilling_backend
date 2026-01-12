const mongoose = require('mongoose');

const userFinancialYearSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    companyId: {
        type: String, // Or ObjectId depending on implementation, prompt uses companyId + financialYearId
        required: true,
        index: true
    },
    activeFinancialYearId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinancialYear',
        required: true,
        index: true
    }
}, {
    timestamps: true,
    collection: 'user_financial_years',
    versionKey: false,
    read: 'secondaryPreferred'
});

// Sharding hint/Compound index for high scalability (100M+ users)
userFinancialYearSchema.index({ userId: 1, companyId: 1 }, { unique: true });
userFinancialYearSchema.index({ companyId: 1, activeFinancialYearId: 1 });

module.exports = mongoose.model('UserFinancialYear', userFinancialYearSchema);
