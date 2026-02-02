const mongoose = require('mongoose');

const bankStatementImportSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    totalRecords: {
        type: Number,
        default: 0
    },
    parsedTransactions: [{
        date: Date,
        description: String,
        debit: { type: Number, default: 0 },
        credit: { type: Number, default: 0 },
        balance: { type: Number, default: 0 }, // Optional, sometimes present
        status: { // 'valid', 'duplicate', 'error'
            type: String,
            default: 'valid'
        },
        validationMessage: String
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('BankStatementImport', bankStatementImportSchema);
