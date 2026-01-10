const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    barcodeNumber: { type: String },
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

const purchaseInvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Section 1: Vendor Information
    vendorInformation: {
        ms: { type: String, required: [true, 'M/S (Vendor Name) is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        shippingAddress: { type: String },
        placeOfSupply: { type: String, required: [true, 'Place of Supply is required'] }
    },
    // Section 2: Invoice Details
    invoiceDetails: {
        invoiceType: { type: String },
        invoiceNumber: { type: String, required: [true, 'Invoice Number is required'] },
        date: { type: Date, required: [true, 'Date is required'] },
        delivery: { type: String }
    },
    // Section 3: Product Items
    items: [purchaseItemSchema],
    // Section 4: Totals and Footer
    totals: {
        totalTaxable: { type: Number, default: 0 },
        totalCGST: { type: Number, default: 0 },
        totalSGST: { type: Number, default: 0 },
        totalIGST: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        roundOff: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        totalInWords: { type: String }
    },
    paymentType: {
        type: String,
        required: [true, 'Payment Type is required'],
        enum: ['CREDIT', 'CASH', 'CHEQUE', 'ONLINE']
    },
    dueDate: { type: Date },
    termsAndConditions: { type: String },
    notes: { type: String }
}, {
    timestamps: true
});

// Index for duplicate check: userId + vendor (M/S) + invoiceNumber + date
purchaseInvoiceSchema.index({
    userId: 1,
    'vendorInformation.ms': 1,
    'invoiceDetails.invoiceNumber': 1,
    'invoiceDetails.date': 1
}, { unique: true });

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
