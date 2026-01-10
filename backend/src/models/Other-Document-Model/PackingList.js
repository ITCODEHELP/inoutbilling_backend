const mongoose = require('mongoose');

const packingListItemSchema = new mongoose.Schema({
    pkgNo: { type: String, trim: true },
    sr: { type: Number },
    productDescription: { type: String, required: true },
    productGroup: { type: String, trim: true }, // For search
    qty: { type: Number, required: true },
    noOfPackages: { type: Number, default: 0 },
    netWeight: { type: Number, default: 0 },
    kindOfPackage: { type: String, trim: true },
    grossWeight: { type: Number, default: 0 },
    dimensions: { type: String, trim: true },
    itemNote: { type: String, trim: true }
});

const packingListSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    customerInformation: {
        ms: { type: String, required: true },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        dispatchFrom: { type: String },
        dispatchAddress: { type: String },
        placeOfSupply: { type: String }
    },
    shippingAddress: {
        street: { type: String },
        city: { type: String },
        state: { type: String },
        country: { type: String },
        pincode: { type: String }
    },
    useSameShippingAddress: { type: Boolean, default: false },
    packingListDetails: {
        prefix: { type: String, trim: true },
        number: { type: String, required: true, trim: true },
        postfix: { type: String, trim: true },
        invoiceNumber: { type: String, required: true, trim: true },
        invoiceDate: { type: Date, required: true },
        challanNo: { type: String, trim: true },
        invoiceType: {
            type: String,
            enum: ['Regular', 'Bill of Supply', 'SEZ with IGST', 'SEZ without IGST', 'Export with IGST', 'Export without IGST'],
            default: 'Regular'
        },
        delivery: { type: String }
    },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff' },
    items: [packingListItemSchema],
    totals: {
        totalPackages: { type: Number, default: 0 },
        totalGrossWeight: { type: Number, default: 0 },
        totalNetWeight: { type: Number, default: 0 }
    },
    additionalInfo: { type: String },
    termsAndConditions: { type: String },
    remarks: { type: String },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    pdfUrl: { type: String },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Indexes for search performance
packingListSchema.index({ userId: 1, isDeleted: 1 });
packingListSchema.index({ 'customerInformation.ms': 'text', 'packingListDetails.number': 1 });

module.exports = mongoose.model('PackingList', packingListSchema);
