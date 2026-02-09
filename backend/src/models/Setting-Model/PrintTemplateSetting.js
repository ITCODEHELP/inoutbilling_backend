const mongoose = require('mongoose');

// Template configuration schema for each document type
const templateConfigSchema = new mongoose.Schema({
    documentType: {
        type: String,
        required: true,
        enum: [
            'Sale Invoice',
            'Delivery Challan',
            'Quotation',
            'Proforma',
            'Purchase Order',
            'Sale Order',
            'Job Work',
            'Credit Note',
            'Debit Note',
            'Purchase Invoice',
            'Multi Currency Invoice',
            'Payment Receipt',
            'Daily Expense',
            'Other Income',
            'Letters',
            'Packing List'
        ]
    },
    selectedTemplate: {
        type: String,
        required: true,
        enum: [
            'Default',
            'Designed',
            'Letterpad',
            'Template-1',
            'Template-2',
            'Template-3',
            'Template-4',
            'Template-5',
            'Template-6',
            'Template-7',
            'Template-8',
            'Template-9',
            'Template-10',
            'Template-11',
            'Template-12',
            'Template-13',
            'A5-Default',
            'A5-Designed',
            'A5-Letterpad',
            'Template-A5-4',
            'Template-A5-5',
            'Thermal-2inch',
            'Thermal-3inch',
            'Thermal-4inch'
        ],
        default: 'Default'
    },
    // Print size and orientation only for standard templates
    printSize: {
        type: String,
        enum: ['A4', 'A5', 'Letter', null],
        default: null
    },
    printOrientation: {
        type: String,
        enum: ['Portrait', 'Landscape', null],
        default: null
    }
}, { _id: false });

const printTemplateSettingsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    branchId: {
        type: String,
        default: 'main'
    },
    templateConfigurations: [templateConfigSchema]
}, {
    timestamps: true
});

// Compound unique index for userId and branchId
printTemplateSettingsSchema.index({ userId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('PrintTemplateSettings', printTemplateSettingsSchema);
