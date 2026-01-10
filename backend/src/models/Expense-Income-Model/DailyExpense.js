const mongoose = require('mongoose');

const dailyExpenseSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    expenseNo: {
        type: String,
        required: [true, 'Expense Number is required']
    },

    expenseDate: {
        type: Date,
        required: [true, 'Expense Date is required']
    },

    category: {
        type: String,
        required: [true, 'Category is required']
    },

    isGstBill: {
        type: Boolean,
        default: false
    },

    party: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
        default: null
    },

    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },

    paymentType: {
        type: String,
        enum: ['CASH', 'CHEQUE', 'ONLINE', 'BANK'],
        required: true
    },

    // backward compatibility
    paymentMethod: {
        type: String
    },

    remarks: {
        type: String,
        default: ''
    },

    // backward compatibility
    description: {
        type: String
    },

    attachment: {
        type: String,
        default: ''
    },

    // 🔧 FIX: amount is DERIVED, not required
    amount: {
        type: Number,
        default: 0
    },

    totalTaxable: {
        type: Number,
        default: 0
    },

    totalTax: {
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
        name: { type: String, required: true },
        note: String,
        quantity: { type: Number, required: true, default: 1 },
        price: { type: Number, required: true },
        amount: { type: Number, required: true }
    }],

    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    },

    importId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DailyExpenseImport',
        default: null
    }

}, { timestamps: true });


dailyExpenseSchema.index({ userId: 1, expenseDate: -1 });
dailyExpenseSchema.index({ userId: 1, party: 1 });
dailyExpenseSchema.index({ userId: 1, staff: 1 });
dailyExpenseSchema.index({ userId: 1, category: 1 });
dailyExpenseSchema.index({ userId: 1, grandTotal: 1 });

dailyExpenseSchema.pre('save', async function () {
    this.amount = this.grandTotal;
    this.description = this.remarks;
    this.paymentMethod = this.paymentType;
});

module.exports = mongoose.model('DailyExpense', dailyExpenseSchema);
