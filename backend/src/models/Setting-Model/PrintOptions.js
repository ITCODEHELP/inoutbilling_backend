const mongoose = require('mongoose');

const printOptionsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },

    // --- Header Print Settings ---
    headerPrintSettings: {
        hideDispatchFrom: { type: Boolean, default: false },
        hideContactDetailInHeader: { type: Boolean, default: false },
        showPanNumber: { type: Boolean, default: true },
        showExporterDetails: { type: Boolean, default: true },
        showStaffDetailsInHeader: { type: Boolean, default: false },
        showBlankCustomFields: { type: Boolean, default: false },
        headerInPdfEmail: { type: String, default: 'Default' }, // 'Default', 'Letterhead', etc.
        letterpadHeaderSize: { type: String, default: 'Medium' } // 'Small', 'Medium', 'Large'
    },

    // --- Customer & Document Print Settings ---
    customerDocumentPrintSettings: {
        showContactPerson: { type: Boolean, default: true },
        showStateInCustomerDetail: { type: Boolean, default: true },
        printShipToDetails: { type: Boolean, default: true },
        showPaymentReceived: { type: Boolean, default: true },
        showTotalOutstanding: { type: Boolean, default: true },
        showReverseCharge: { type: Boolean, default: false },
        hideDueDate: { type: Boolean, default: false },
        hideTransport: { type: Boolean, default: false },
        hideCurrencyRate: { type: Boolean, default: false }
    },

    // --- Product Item Settings ---
    productItemSettings: {
        productImageLocation: { type: String, default: 'None' }, // 'None', 'Left', 'Right'
        hideRateColumn: { type: Boolean, default: false },
        hideQuantityColumn: { type: Boolean, default: false },
        hideHsnColumn: { type: Boolean, default: false },
        hideDiscountColumn: { type: Boolean, default: false },
        showUomDifferentColumn: { type: Boolean, default: false },
        hideSrNoAdditionalCharges: { type: Boolean, default: false },
        hideTotalQuantity: { type: Boolean, default: false }
    },

    // --- Footer Print Settings ---
    footerPrintSettings: {
        showRoundOff: { type: Boolean, default: true },
        showPageNumber: { type: Boolean, default: true },
        printSignatureImage: { type: Boolean, default: true },
        showHsnSummary: { type: Boolean, default: true },
        hsnSummaryOption: { type: String, default: 'Default' },
        showSubtotalDiscount: { type: Boolean, default: true },
        showPaymentReceivedBalance: { type: Boolean, default: true },
        letterpadFooterSize: { type: String, default: 'Medium' },
        showCustomerSignatureBox: { type: Boolean, default: true },
        customerSignatureLabel: { type: String, default: 'Customer Signature' },
        footerText: { type: String, default: '' },
        showFooterImage: { type: Boolean, default: true }
    },

    // --- Document Print Settings (Style) ---
    documentPrintSettings: {
        continuousPrinting: { type: Boolean, default: false }, // For thermal/rolls
        printHeaderEveryPage: { type: Boolean, default: true },
        showCustomerDetailsAllPages: { type: Boolean, default: true },
        printBlackWhite: { type: Boolean, default: false },
        invoiceBorderColor: { type: String, default: '#0070C0' },
        invoiceBackgroundColor: { type: String, default: '#E8F3FD' },
        fontFamily: { type: String, default: 'Roboto' } // 'Roboto', 'Poppins', etc.
    },

    // --- Packing List Settings ---
    packingListPrintSettings: {
        productsShowBoxWise: { type: Boolean, default: false }
    },

    // Additional flexible field for any other settings
    otherSettings: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, {
    timestamps: true,
    strict: false // Allow additional fields not defined in schema
});

module.exports = mongoose.model('PrintOptions', printOptionsSchema);
