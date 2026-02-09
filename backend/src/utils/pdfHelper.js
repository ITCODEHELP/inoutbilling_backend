const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates an invoice PDF as a Buffer (Legacy/Generic wrapper).
 */
const generateInvoicePDF = async (invoice, isPurchase = false) => {
    const user = { userId: invoice.userId }; // Minimal user object needed for fetching Business
    const docType = isPurchase ? 'Purchase Invoice' : 'Sale Invoice';
    const printConfig = await fetchAndResolveDocumentOptions(invoice.userId, docType);

    return generateSaleInvoicePDF(
        [invoice],
        user,
        { original: true },
        docType,
        printConfig
    );
};

/**
 * Generates a simple receipt PDF (Legacy wrapper).
 */
const generateReceiptPDF = async (data, type = "EXPENSE") => {
    const docType = type === 'EXPENSE' ? 'Daily Expense' : 'Other Income';
    const user = { userId: data.userId };
    const printConfig = await fetchAndResolveDocumentOptions(data.userId, docType);

    return generateSaleInvoicePDF(
        [data],
        user,
        { original: true },
        docType,
        printConfig
    );
};

/**
 * Generates a Quotation PDF (Legacy wrapper).
 */
const generateQuotationPDF = async (data) => {
    const user = { userId: data.userId };
    const printConfig = await fetchAndResolveDocumentOptions(data.userId, 'Quotation');

    return generateSaleInvoicePDF(
        [data],
        user,
        { original: true },
        'Quotation',
        printConfig
    );
};

/**
 * Generates a Proforma PDF (Legacy wrapper).
 */
const generateProformaPDF = async (data) => {
    const user = { userId: data.userId };
    const printConfig = await fetchAndResolveDocumentOptions(data.userId, 'Proforma');

    return generateSaleInvoicePDF(
        [data],
        user,
        { original: true },
        'Proforma',
        printConfig
    );
};

/**
 * Generates a Delivery Challan PDF (Legacy wrapper).
 */
const generateDeliveryChallanPDF = async (data) => {
    const user = { userId: data.userId };
    const printConfig = await fetchAndResolveDocumentOptions(data.userId, 'Delivery Challan');

    return generateSaleInvoicePDF(
        [data],
        user,
        { original: true },
        'Delivery Challan',
        printConfig
    );
};

/**
 * Generates a Ledger Statement PDF (Legacy/Special handling).
 * Note: Ledger has a very different layout, but we map it into the unified engine for consistency.
 */
const generateLedgerPDF = async (data) => {
    const { user, rows, fromDate, toDate } = data;
    const docType = 'Bank Ledger';
    const printConfig = await fetchAndResolveDocumentOptions(user.userId || user._id, docType);

    // Map ledger data for unified generator
    const docForPdf = {
        invoiceDetails: {
            invoiceNumber: `Statement ${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`,
            date: new Date()
        },
        customerInformation: data.target,
        items: rows.map(r => ({
            date: r.date,
            particulars: r.particulars,
            voucherType: r.voucherType,
            invoiceNo: r.invoiceNo,
            debit: r.debit,
            credit: r.credit,
            balance: r.balance
        })),
        totals: data.totals
    };

    return generateSaleInvoicePDF(
        [docForPdf],
        user,
        { original: true },
        docType,
        printConfig
    );
};

const getCopyOptions = (req) => {
    // Check both query and body to handle GET params in POST requests
    const source = { ...req.query, ...req.body };
    const { original, duplicate, transport, office } = source;

    // Default to true for original if it's the only one and it's undefined
    const isOriginal = original === undefined ? true : (original === 'true' || original === true);

    return {
        original: isOriginal,
        duplicate: duplicate === 'true' || duplicate === true,
        transport: transport === 'true' || transport === true,
        office: office === 'true' || office === true,
    };
};

module.exports = {
    generateInvoicePDF,
    generateReceiptPDF,
    generateQuotationPDF,
    generateProformaPDF,
    generateDeliveryChallanPDF,
    generateLedgerPDF,
    getCopyOptions
};
