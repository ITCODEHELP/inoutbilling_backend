const mongoose = require('mongoose');

const termsConditionsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // Store all terms as a flexible object keyed by document type
    terms: {
        sale_invoice: { type: String, default: '' },
        delivery_challan: { type: String, default: '' },
        quotation: { type: String, default: '' },
        proforma: { type: String, default: '' },
        purchase_order: { type: String, default: '' },
        sale_order: { type: String, default: '' },
        job_work: { type: String, default: '' },
        credit_note: { type: String, default: '' },
        debit_note: { type: String, default: '' },
        multi_currency_invoice: { type: String, default: '' },
        payment_receipt: { type: String, default: '' }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('TermsConditions', termsConditionsSchema);
