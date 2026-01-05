const mongoose = require('mongoose');

const dailyExpenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    expenseDate: {
        type: Date,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    category: {
        type: String,
        required: true
    },
    description: {
        type: String
    },
    paymentMethod: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('DailyExpense', dailyExpenseSchema);
