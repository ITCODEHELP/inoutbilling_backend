const mongoose = require('mongoose');

const generalSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    // Boolean Toggles
    enableRounding: { type: Boolean, default: true },
    enableAuditLogs: { type: Boolean, default: true },
    enableAlerts: { type: Boolean, default: true },
    enableDiscounts: { type: Boolean, default: true },
    enableStickyNotes: { type: Boolean, default: true },
    enableCurrencySymbol: { type: Boolean, default: true },
    enablePaymentTerms: { type: Boolean, default: true },
    enableStockAlerts: { type: Boolean, default: true },

    // Numeric Fields
    recordsPerPage: { type: Number, default: 10 },
    decimalValues: { type: Number, default: 2 },
    quantityDecimals: { type: Number, default: 2 },
    priceDecimals: { type: Number, default: 2 },
    taxDecimals: { type: Number, default: 2 },

    // Enum Fields
    dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
        default: 'DD/MM/YYYY'
    },
    discountType: {
        type: String,
        enum: ['Percentage', 'Fixed Amount'],
        default: 'Percentage'
    },
    roundOffType: {
        type: String,
        enum: ['Normal', 'Upward', 'Downward'],
        default: 'Normal'
    },
    adjustmentApplyOn: {
        type: String,
        enum: ['Before Tax', 'After Tax'],
        default: 'After Tax'
    },

    // Text Fields
    defaultNotes: { type: String, default: '' },
    billOfSupplyTitle: { type: String, default: 'Bill of Supply' },
    declaration: { type: String, default: '' },
    logoLabel: { type: String, default: 'Company Logo' },
    signatureLabel: { type: String, default: 'Authorized Signatory' },

    // Image Paths
    logoPath: { type: String, default: '' },
    signaturePath: { type: String, default: '' },
    invoiceBackgroundPath: { type: String, default: '' },
    invoiceFooterPath: { type: String, default: '' }

}, {
    timestamps: true
});

module.exports = mongoose.model('GeneralSettings', generalSettingsSchema);
