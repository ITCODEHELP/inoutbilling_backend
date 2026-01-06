const mongoose = require('mongoose');

const dailyExpenseItemColumnSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Column Name is required']
    },
    type: {
        type: String,
        enum: ['TEXT', 'NUMBER', 'DROPDOWN'],
        required: [true, 'Column Type is required']
    },
    status: {
        type: String,
        enum: ['Active', 'Inactive'],
        default: 'Active'
    },
    options: {
        type: [String],
        default: []
    },
    orderNo: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Compound index for uniqueness per user
dailyExpenseItemColumnSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('DailyExpenseItemColumn', dailyExpenseItemColumnSchema);
