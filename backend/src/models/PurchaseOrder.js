const mongoose = require('mongoose');

const poItemSchema = new mongoose.Schema({
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

const purchaseOrderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Section 1: Vendor Information
    vendorInformation: {
        ms: { type: String, required: [true, 'ms is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        shipTo: { type: String },
        placeOfSupply: { type: String, required: [true, 'placeOfSupply is required'] }
    },
    // Section 2: Purchase Order Details
    purchaseOrderDetails: {
        purchaseOrderType: {
            type: String,
            default: 'REGULAR'
        },
        poPrefix: { type: String },
        poNumber: { type: String, required: [true, 'poNumber is required'] },
        poPostfix: { type: String },
        date: { type: Date, required: [true, 'date is required'] },
        deliveryMode: {
            type: String,
            enum: ['HAND DELIVERY', 'TRANSPORT/ROAD REGULAR', 'ROAD-OVER DIMENSIONAL', 'RAIL', 'AIR', 'SHIP', 'SHIP-CUM ROAD/RAIL'],
            required: true
        }
    },
    // Section 3: Transport Details
    transportDetails: {
        dispatchThrough: { type: String },
        transportName: { type: String },
        transportIdGstin: { type: String },
        vehicleNo: { type: String },
        documentNo: { type: String },
        documentDate: { type: Date },
        trackingLink: { type: String }
    },
    // Section 4: Product Items
    items: [poItemSchema],
    // Additional Charges
    additionalCharges: [{
        name: String,
        amount: { type: Number, default: 0 },
        tax: { type: Number, default: 0 }
    }],
    // Totals
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
    staff: {
        type: { type: String }
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

purchaseOrderSchema.index({ userId: 1, 'purchaseOrderDetails.poNumber': 1 }, { unique: true });

module.exports = mongoose.model('PurchaseOrder', purchaseOrderSchema);
