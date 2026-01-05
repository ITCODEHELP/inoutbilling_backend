const mongoose = require('mongoose');

const productStockSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // Product Options
    productOptions: {
        mrp: {
            status: { type: Boolean, default: true },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: true },
            allowDuplicate: { type: Boolean, default: true }
        },
        productCode: {
            status: { type: Boolean, default: true },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: true },
            allowDuplicate: { type: Boolean, default: false }
        },
        barcodeNo: {
            status: { type: Boolean, default: true },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: true },
            allowDuplicate: { type: Boolean, default: false }
        },
        enableSearchByAnyWord: { type: Boolean, default: true }
    },

    // Stock Options
    stockOptions: {
        allowSalesWithoutStock: { type: Boolean, default: false },
        hideOutOfStockProducts: { type: Boolean, default: false },
        hideOutOfStockBatches: { type: Boolean, default: false }
    },

    // Serial Number Settings
    serialNumberSettings: {
        fieldName: { type: String, default: 'Serial Number' },
        strictMode: { type: Boolean, default: false },
        applicableDocuments: {
            quotation: { type: Boolean, default: false },
            proformaInvoice: { type: Boolean, default: false },
            saleOrder: { type: Boolean, default: false },
            deliveryChallan: { type: Boolean, default: false }
        }
    },

    // Batch Settings
    batchSettings: {
        batchNo: {
            type: { type: String, enum: ['text', 'number'], default: 'text' },
            status: { type: Boolean, default: true },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: true },
            inputOption: { type: String, enum: ['text', 'date', 'month'], default: 'text' }
        },
        modelNo: {
            type: { type: String, enum: ['text', 'number'], default: 'text' },
            status: { type: Boolean, default: false },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: false },
            inputOption: { type: String, enum: ['text', 'date', 'month'], default: 'text' }
        },
        size: {
            type: { type: String, enum: ['text', 'number'], default: 'text' },
            status: { type: Boolean, default: false },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: false },
            inputOption: { type: String, enum: ['text', 'date', 'month'], default: 'text' }
        },
        mfgDate: {
            type: { type: String, enum: ['text', 'number', 'date'], default: 'date' },
            status: { type: Boolean, default: false },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: false },
            inputOption: { type: String, enum: ['text', 'date', 'month'], default: 'date' }
        },
        expiryDate: {
            type: { type: String, enum: ['text', 'number', 'date'], default: 'date' },
            status: { type: Boolean, default: false },
            required: { type: Boolean, default: false },
            print: { type: Boolean, default: false },
            inputOption: { type: String, enum: ['text', 'date', 'month'], default: 'date' }
        }
    },

    // Enable Batch Options for Other Documents
    batchOptionsForDocuments: {
        quotation: { type: Boolean, default: false },
        proformaInvoice: { type: Boolean, default: false },
        deliveryChallan: { type: Boolean, default: false },
        purchaseOrder: { type: Boolean, default: false },
        saleOrder: { type: Boolean, default: false },
        jobWork: { type: Boolean, default: false }
    },

    // Barcode Options
    barcodeOptions: {
        minimumBarcodeScanLength: { type: Number, default: 3, min: 1, max: 50 },
        focusAfterScan: {
            type: String,
            enum: ['quantity', 'rate', 'discount', 'next_row', 'barcode'],
            default: 'quantity'
        },
        alwaysAddNewRowOnScan: { type: Boolean, default: false }
    }

}, {
    timestamps: true
});

module.exports = mongoose.model('ProductStockSettings', productStockSettingsSchema);
