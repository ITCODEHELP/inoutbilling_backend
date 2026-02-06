const mongoose = require('mongoose');

// --- Reusable Sub-Schemas ---

const invoiceSeriesSchema = new mongoose.Schema({
    seriesType: {
        type: String,
        required: true,
        enum: ['Default', 'Export', 'Custom']
    },
    enabled: {
        type: Boolean,
        default: false
    },
    name: {
        type: String,
        default: ''
    },
    invoiceTitle: {
        type: String,
        default: ''
    },
    prefix: {
        type: String,
        default: ''
    },
    postfix: {
        type: String,
        default: ''
    }
}, { _id: false });

const statusOptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    color: {
        type: String,
        enum: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Grey'],
        default: 'Grey'
    }
}, { _id: false });

const statusSettingsSchema = new mongoose.Schema({
    showStatus: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Status'
    },
    options: [statusOptionSchema]
}, { _id: false });

const completionDateSchema = new mongoose.Schema({
    showCompletionDate: {
        type: Boolean,
        default: false
    },
    label: {
        type: String,
        default: 'Completion Date'
    },
    defaultDate: {
        type: Number, // Days from invoice date
        default: 0
    }
}, { _id: false });

// --- Specific Document Schemas ---

// 1. Sale Invoice (Existing)
const saleInvoiceSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    defaultOptions: {
        sortBy: { type: String, default: 'Invoice No ( Descending )' },
        invoiceType: { type: String, default: 'No default invoice type' },
        defaultCustomer: { type: mongoose.Schema.Types.Mixed, default: 'No default customer' },
        defaultPaymentType: { type: String, default: 'CREDIT' },
        defaultDueDate: { type: Number, default: null }
    }
}, { _id: false });

// Shared Other Options for Delivery Challan, Quotation, Proforma
const standardOtherOptionsSchema = new mongoose.Schema({
    disableTax: { type: Boolean, default: false },
    disablePrice: { type: Boolean, default: false },
    defaultProductNote: { type: String, default: '' }
}, { _id: false });

// Shared keys but distinct schemas to allow future divergence
const deliveryChallanSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    completionDate: completionDateSchema,
    otherOptions: standardOtherOptionsSchema
}, { _id: false });

const quotationSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    completionDate: completionDateSchema,
    otherOptions: standardOtherOptionsSchema
}, { _id: false });

const proformaSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    completionDate: completionDateSchema,
    otherOptions: standardOtherOptionsSchema
}, { _id: false });

// Purchase/Sale Order have extra fields (Progress Bar)
const orderOtherOptionsSchema = new mongoose.Schema({
    showRemainingQtyProgress: { type: Boolean, default: false }, // Specific to Orders
    disableTax: { type: Boolean, default: false },
    disablePrice: { type: Boolean, default: false },
    defaultProductNote: { type: String, default: '' }
}, { _id: false });

const purchaseOrderSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    completionDate: completionDateSchema,
    otherOptions: orderOtherOptionsSchema
}, { _id: false });

const saleOrderSchema = new mongoose.Schema({
    invoiceSeries: [invoiceSeriesSchema],
    statusSettings: statusSettingsSchema,
    completionDate: completionDateSchema,
    otherOptions: orderOtherOptionsSchema
}, { _id: false });

// --- Main Model ---

const documentOptionSchema = new mongoose.Schema({
    userId: {
        type: String,
        ref: 'User',
        required: true,
        unique: true
    },

    // Schemas
    saleInvoice: { type: saleInvoiceSchema, default: () => ({}) },
    deliveryChallan: { type: deliveryChallanSchema, default: () => ({}) },
    quotation: { type: quotationSchema, default: () => ({}) },
    proforma: { type: proformaSchema, default: () => ({}) },
    purchaseOrder: { type: purchaseOrderSchema, default: () => ({}) },
    saleOrder: { type: saleOrderSchema, default: () => ({}) },

    // Flexible placeholders for future
    jobWork: { type: mongoose.Schema.Types.Mixed, default: {} },
    purchaseInvoice: { type: mongoose.Schema.Types.Mixed, default: {} },
    creditNote: { type: mongoose.Schema.Types.Mixed, default: {} },
    debitNote: { type: mongoose.Schema.Types.Mixed, default: {} },
    multiCurrencyInvoice: { type: mongoose.Schema.Types.Mixed, default: {} },
    paymentType: { type: mongoose.Schema.Types.Mixed, default: {} },
    letterOptions: { type: mongoose.Schema.Types.Mixed, default: {} },
    inwardPayment: { type: mongoose.Schema.Types.Mixed, default: {} },
    outwardPayment: { type: mongoose.Schema.Types.Mixed, default: {} }

}, {
    timestamps: true
});

module.exports = mongoose.model('DocumentOption', documentOptionSchema);
