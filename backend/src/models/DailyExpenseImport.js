const mongoose = require('mongoose');

const dailyExpenseImportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    totalRows: {
        type: Number,
        default: 0
    },
    importedCount: {
        type: Number,
        default: 0
    },
    failedCount: {
        type: Number,
        default: 0
    },
    errorLogs: [{
        expenseNo: String,
        row: Number,
        error: String
    }],
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Completed'
    }
}, { timestamps: true });

module.exports = mongoose.model('DailyExpenseImport', dailyExpenseImportSchema);
