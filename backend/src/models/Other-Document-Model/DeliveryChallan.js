const mongoose = require('mongoose');

const challanItemSchema = new mongoose.Schema({
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

const deliveryChallanSchema = new mongoose.Schema({
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
    // Section 2: Delivery Challan Details
    deliveryChallanDetails: {
        deliveryChallanType: {
            type: String,
            enum: ['REGULAR', 'JOB WORK', 'SKD/CKD', 'FOR OWN USE', 'JOB WORK RETURN', 'SALES RETURN', 'EXHIBITION OR FAIR', 'LINE SALES', 'RECIPIENT NOT KNOWN', 'SEZ INVOICE WITH IGST', 'SEZ INVOICE WITHOUT IGST', 'EXPORT INVOICE WITH IGST', 'EXPORT INVOICE WITHOUT IGST', 'OTHER'],
            default: 'REGULAR'
        },
        challanPrefix: { type: String },
        challanNumber: { type: String, required: [true, 'challanNumber is required'] },
        challanPostfix: { type: String },
        date: { type: Date, required: [true, 'date is required'] },
        deliveryMode: {
            type: String,
            enum: ['HAND DELIVERY', 'TRANSPORT/ROAD REGULAR', 'ROAD-OVER DIMENSIONAL', 'RAIL', 'AIR', 'SHIP', 'SHIP-CUM ROAD/RAIL'],
            required: true
        },
        eWayBill: {
            type: String,
            enum: ['NO_EWAY_BILL', 'GENERATE_EWAY_BILL', 'CANCELLED_EWAY_BILL'],
            default: 'NO_EWAY_BILL'
        },
        supplyType: {
            type: String,
            enum: ['OUTWARD', 'INWARD'],
            default: 'OUTWARD'
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
    items: [challanItemSchema],
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

deliveryChallanSchema.index({ userId: 1, 'deliveryChallanDetails.challanNumber': 1 }, { unique: true });

module.exports = mongoose.model('DeliveryChallan', deliveryChallanSchema);
