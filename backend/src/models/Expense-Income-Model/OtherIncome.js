const mongoose = require('mongoose');

const otherIncomeSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    incomeNo: {
        type: String,
        required: [true, 'Income Number is required']
    },
    incomeDate: {
        type: Date,
        required: [true, 'Income Date is required']
    },
    category: {
        type: String,
        required: false,
        default: ''
    },
    paymentType: {
        type: String,
        enum: ['CASH', 'CHEQUE', 'ONLINE', 'BANK'],
        required: true
    },
    remarks: {
        type: String,
        default: ''
    },
    totalInvoiceValue: {
        type: Number,
        default: 0
    },
    roundOff: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number,
        default: 0
    },
    amountInWords: {
        type: String,
        default: ''
    },
    items: [{
        incomeName: { type: String, required: true },
        note: String,
        price: { type: Number, required: true },
        amount: { type: Number, required: true }
    }],
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

otherIncomeSchema.index({ userId: 1, incomeNo: 1 }, { unique: true });
otherIncomeSchema.index({ userId: 1, incomeDate: -1 });
otherIncomeSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model('OtherIncome', otherIncomeSchema);
