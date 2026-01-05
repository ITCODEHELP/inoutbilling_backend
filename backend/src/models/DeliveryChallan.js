const mongoose = require('mongoose');

const challanItemSchema = new mongoose.Schema({
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

const deliveryChallanSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    saleInvoiceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SaleInvoice'
    },
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
    challanDetails: {
        challanNumber: { type: String, required: [true, 'challanNumber is required'] },
        date: { type: Date, required: [true, 'date is required'] },
        deliveryMode: { type: String }
    },
    items: [challanItemSchema],
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
    additionalNotes: { type: String },
    documentRemarks: { type: String }
}, {
    timestamps: true
});

module.exports = mongoose.model('DeliveryChallan', deliveryChallanSchema);
