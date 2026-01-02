const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    itemNote: { type: String },
    hsnSac: { type: String },
    qty: { type: Number, default: 0 },
    uom: { type: String },
    price: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
});

const saleInvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Section 1: Customer Information
    customerInformation: {
        ms: { type: String, required: [true, 'ms is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        shipTo: { type: String },
        placeOfSupply: { type: String, required: [true, 'placeOfSupply is required'] }
    },
    // Section 2: Invoice Details
    invoiceDetails: {
        invoiceType: { type: String },
        invoicePrefix: { type: String },
        invoiceNumber: { type: String, required: [true, 'invoiceNumber is required'], unique: true },
        invoicePostfix: { type: String },
        date: { type: Date, required: [true, 'date is required'] },
        deliveryMode: { type: String }
    },
    // Section 3: Product Items
    items: [invoiceItemSchema],
    // Totals and Footer
    totals: {
        totalInvoiceValue: { type: Number, default: 0 },
        totalTaxable: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        totalCGST: { type: Number, default: 0 },
        totalSGST: { type: Number, default: 0 },
        totalIGST: { type: Number, default: 0 },
        roundOff: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        totalInWords: { type: String }
    },
    paymentType: {
        type: String,
        required: [true, 'paymentType is required'],
        enum: ['CREDIT', 'CASH', 'CHEQUE', 'ONLINE']
    },
    dueDate: { type: Date },
    bankDetails: { type: String },
    termsTitle: { type: String },
    termsDetails: { type: String },
    additionalNotes: { type: String },
    documentRemarks: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('SaleInvoice', saleInvoiceSchema);
