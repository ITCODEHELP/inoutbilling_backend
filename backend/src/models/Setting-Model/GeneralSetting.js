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

    // New Toggles from Frontend
    showProductPriceLastInvoice: { type: Boolean, default: false },
    updateQtyKeepPrice: { type: Boolean, default: false },
    enableProductNote: { type: Boolean, default: false },
    showExportShippingDetail: { type: Boolean, default: false },
    showExpenseSuggestions: { type: Boolean, default: true },
    validateHsn: { type: Boolean, default: false },
    showAlertReverseCharge: { type: Boolean, default: false },
    showAlertPastFutureDate: { type: Boolean, default: false },
    enableAuditTrail: { type: Boolean, default: true },
    allowOtherCurrency: { type: Boolean, default: false },
    searchProductsByAnyWord: { type: Boolean, default: false },
    showDiscountField: { type: Boolean, default: true },
    calculateDiscountPerItem: { type: Boolean, default: false },
    showDiscountColumn: { type: Boolean, default: true },
    showGeneralDiscount: { type: Boolean, default: false },
    showAmountAdjustment: { type: Boolean, default: false },
    showTotalDiscount: { type: Boolean, default: false },
    autoMapFields: { type: Boolean, default: true },
    enableSignature: { type: Boolean, default: false },

    // Numeric Fields
    recordsPerPage: { type: Number, default: 20 },
    decimalValues: { type: Number, default: 2 },
    quantityDecimals: { type: Number, default: 2 },
    priceDecimals: { type: Number, default: 2 },
    taxDecimals: { type: Number, default: 2 },

    // Precision Fields from Frontend
    quantityPrecision: { type: Number, default: 2 },
    pricePrecision: { type: Number, default: 2 },
    taxableTotalPrecision: { type: Number, default: 2 },
    gstRatePrecision: { type: Number, default: 2 },
    gstAmountPrecision: { type: Number, default: 2 },
    currencyPrecision: { type: Number, default: 2 },

    // Enum Fields
    dateFormat: {
        type: String,
        enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD', 'd-M-y'],
        default: 'DD/MM/YYYY'
    },
    discountType: {
        type: String,
        enum: ['Percentage', 'Fixed Amount', 'Percentage (%)'],
        default: 'Percentage'
    },
    defaultDiscountType: {
        type: String,
        enum: ['Percentage', 'Fixed Amount', 'Percentage (%)'],
        default: 'Percentage (%)'
    },
    roundOffType: {
        type: String,
        enum: ['Normal', 'Upward', 'Downward', 'Default', 'Nearest'],
        default: 'Normal'
    },
    roundOffValue: {
        type: String,
        enum: ['Default', 'Normal', 'Upward', 'Downward', 'Nearest'],
        default: 'Default'
    },
    adjustmentApplyOn: {
        type: String,
        enum: ['Before Tax', 'After Tax', 'Amount After Tax', 'Amount Before Tax'],
        default: 'After Tax'
    },
    applyAdjustmentOn: {
        type: String,
        enum: ['Amount Before Tax', 'Amount After Tax', 'Before Tax', 'After Tax'],
        default: 'Amount After Tax'
    },

    // Text Fields
    defaultNotes: { type: String, default: '' },
    customFileNamePattern: { type: String, default: '' },
    defaultProductNote: { type: String, default: '' },
    generalDiscountLabel: { type: String, default: 'General Discount' },
    amountAdjustmentField: { type: String, default: 'TCS' },
    totalDiscountLabel: { type: String, default: 'Discount' },
    billOfSupplyTitle: { type: String, default: 'Bill of Supply' },
    billOfSupplyDeclaration: { type: String, default: '' },
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

