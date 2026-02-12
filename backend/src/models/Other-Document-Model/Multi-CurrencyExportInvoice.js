const mongoose = require('mongoose');

const exportInvoiceItemSchema = new mongoose.Schema({
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
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

const shippingAddressSchema = new mongoose.Schema({
    street: { type: String },
    landmark: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: String },
    distance: { type: Number, default: 0 }
});

const exportShippingDetailsSchema = new mongoose.Schema({
    shipBillNo: { type: String },
    shipBillDate: { type: Date },
    shipPortCode: { type: String },
    preCarriageBy: { type: String },
    placeOfPreCarriage: { type: String },
    vesselOrFlightNo: { type: String },
    portOfLoading: { type: String },
    portOfDischarge: { type: String },
    finalDestination: { type: String },
    countryOfOrigin: { type: String },
    countryOfFinal: { type: String },
    weightKg: { type: Number, default: 0 },
    packages: { type: Number, default: 0 }
});

const exportInvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Section 1: Customer Information
    customerInformation: {
        ms: { type: String, required: [true, 'M/S is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        placeOfSupply: { type: String, required: [true, 'Place of Supply is required'] }
    },
    useSameShippingAddress: { type: Boolean, default: true },
    shippingAddress: shippingAddressSchema,

    // Section 2: Invoice Details
    invoiceDetails: {
        invoiceType: {
            type: String,
            required: [true, 'Invoice Type is required'],
            enum: ['Export Invoice (With IGST)', 'Export Invoice (Without IGST)']
        },
        invoicePrefix: { type: String },
        invoiceNumber: { type: String, required: [true, 'Invoice Number is required'] },
        invoicePostfix: { type: String },
        date: { type: Date, required: [true, 'Date is required'] },
        deliveryMode: { type: String }
    },
    // Currency Information
    currency: {
        code: { type: String, required: [true, 'Currency Code is required'], default: 'AED' },
        symbol: { type: String, default: 'AED' }
    },
    // Section 3: Export Shipping Details (Mandatory for Export Invoices)
    exportShippingDetails: {
        type: exportShippingDetailsSchema,
        required: [true, 'Export Shipping Details are required']
    },
    // Section 4: Product Items
    items: [exportInvoiceItemSchema],
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
    branch: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    bankDetails: { type: mongoose.Schema.Types.Mixed },
    termsTitle: { type: String },
    termsDetails: { type: [String] },
    documentRemarks: { type: String },
    shareOnEmail: { type: Boolean, default: false },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    status: {
        type: String,
        enum: ['Active', 'Cancelled'],
        default: 'Active'
    },
    attachments: [{
        fileName: String,
        filePath: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
}, {
    timestamps: true
});

exportInvoiceSchema.index({ userId: 1, 'invoiceDetails.invoiceNumber': 1 }, { unique: true });

module.exports = mongoose.model('ExportInvoice', exportInvoiceSchema);

