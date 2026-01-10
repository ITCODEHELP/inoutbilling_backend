const mongoose = require('mongoose');

const proformaItemSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    productGroup: { type: String },
    itemNote: { type: String },
    hsnSac: { type: String },
    qty: { type: Number, default: 0 },
    uom: { type: String },
    price: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

const proformaSchema = new mongoose.Schema({
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
    useSameShippingAddress: { type: Boolean, default: true },
    shippingAddress: {
        street: { type: String },
        landmark: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        pincode: { type: String },
        distance: { type: Number, default: 0 }
    },
    // Section 2: Proforma Details
    proformaDetails: {
        proformaType: {
            type: String,
            enum: ['Regular', 'Bill of Supply', 'SEZ Invoice with IGST', 'SEZ Invoice without IGST', 'Export Invoice with IGST', 'Export Invoice without IGST'],
            default: 'Regular'
        },
        proformaPrefix: { type: String },
        proformaNumber: { type: String, required: [true, 'proformaNumber is required'] },
        proformaPostfix: { type: String },
        date: { type: Date, required: [true, 'date is required'] },
        deliveryMode: {
            type: String,
            enum: ['HAND DELIVERY', 'TRANSPORT/ROAD REGULAR', 'ROAD-OVER DIMENSIONAL', 'RAIL', 'AIR', 'SHIP', 'SHIP-CUM ROAD/RAIL'],
            required: true
        }
    },
    // Section 3: Transport Details (Optional/Conditional)
    transportDetails: {
        dispatchThrough: { type: String },
        transportName: { type: String },
        transportIdGstin: { type: String },
        vehicleNo: { type: String },
        documentNo: { type: String },
        documentDate: { type: Date },
        trackingLink: { type: String } // Supports {{LR No}} placeholder
    },
    // Section 4: Product Items
    items: [proformaItemSchema],
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
        enum: ['CREDIT', 'CASH', 'CHEQUE', 'ONLINE'],
        default: 'CASH'
    },
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    bankDetails: { type: String },
    termsTitle: { type: String },
    termsDetails: { type: String },
    documentRemarks: { type: String },
    customFields: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

proformaSchema.index({ userId: 1, 'proformaDetails.proformaNumber': 1 }, { unique: true });

module.exports = mongoose.model('Proforma', proformaSchema);
