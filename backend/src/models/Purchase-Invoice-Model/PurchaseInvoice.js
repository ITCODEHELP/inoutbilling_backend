const mongoose = require('mongoose');

const purchaseItemSchema = new mongoose.Schema({
    productName: { type: String, required: true, index: true },
    barcodeNumber: { type: String },
    hsnSac: { type: String, index: true },
    qty: { type: Number, default: 0 },
    uom: { type: String },
    itemNote: { type: String },
    price: { type: Number, default: 0 },
    discountType: { type: String, enum: ['Percentage', 'Flat'], default: 'Flat' },
    discountValue: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    taxableValue: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    productGroup: { type: String, index: true }
}, { _id: false });

const purchaseInvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Section 1: Vendor Information
    vendorInformation: {
        ms: { type: String, required: [true, 'M/S (Vendor Name) is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        shipTo: { type: String },
        placeOfSupply: { type: String, required: [true, 'Place of Supply is required'] }
    },
    // Section 2: Invoice Details
    invoiceDetails: {
        invoiceType: { type: String, index: true },
        invoicePrefix: { type: String, index: true },
        invoiceNumber: { type: String, required: [true, 'Invoice Number is required'], index: true },
        invoicePostfix: { type: String },
        date: { type: Date, required: [true, 'Date is required'], index: true },
        deliveryMode: { type: String }
    },
    // Section 3: Product Items
    items: [purchaseItemSchema],

    // Section 4: Additional Charges
    additionalCharges: [{
        chargeName: { type: String },
        chargeAmount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 }
    }],

    // Add due date for outstanding calculations
    dueDate: { type: Date, index: true },

    // Totals and Summary
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
        required: [true, 'Payment Type is required'],
        enum: ['CREDIT', 'CASH', 'CHEQUE', 'ONLINE'],
        index: true
    },

    paidAmount: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['Active', 'Cancelled', 'Draft', 'Paid', 'Partial', 'Unpaid', 'Completed', 'Pending'],
        default: 'Active',
        index: true
    },

    // Conversions
    conversions: {
        convertedTo: [{
            docType: { type: String },
            docId: { type: mongoose.Schema.Types.ObjectId }
        }],
        convertedFrom: {
            docType: { type: String },
            docId: { type: mongoose.Schema.Types.ObjectId }
        }
    },

    // E-Way Bill
    eWayBill: {
        generated: { type: Boolean, default: false },
        eWayBillNumber: { type: String },
        eWayBillDate: { type: Date },
        eWayBillJson: { type: mongoose.Schema.Types.Mixed }
    },

    // Attachments
    attachments: [{
        fileName: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        mimeType: { type: String }
    }],

    bankDetails: { type: String },
    termsTitle: { type: String },
    termsAndConditions: {
        title: { type: String },
        text: { type: String }
    },
    notes: { type: String },
    documentRemarks: { type: String },
    printRemarksFlag: { type: Boolean, default: true },

    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        index: true
    },

    transportDetails: {
        lrNo: { type: String, index: true },
        vehicleNo: { type: String },
        transportName: { type: String }
    },

    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        index: true
    }

}, {
    timestamps: true
});

// Pre-save middleware for due date
purchaseInvoiceSchema.pre('save', async function () {
    if (!this.dueDate && this.invoiceDetails?.date) {
        const dDate = new Date(this.invoiceDetails.date);
        dDate.setDate(dDate.getDate() + 30);
        this.dueDate = dDate;
    }
});

// Compound index for uniqueness
purchaseInvoiceSchema.index({
    userId: 1,
    'vendorInformation.ms': 1,
    'invoiceDetails.invoiceNumber': 1,
    'invoiceDetails.date': 1
}, { unique: true });

module.exports = mongoose.model('PurchaseInvoice', purchaseInvoiceSchema);
