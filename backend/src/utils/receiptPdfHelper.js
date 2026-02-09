const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates a Receipt or Payment Voucher PDF by delegating to the unified Sale Invoice PDF engine.
 * @param {Object|Array} dataItems - Single or Multiple Payment records.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {String} title - Voucher Title (e.g., "RECEIPT VOUCHER" or "PAYMENT VOUCHER").
 * @param {Object} labels - Labels for unique fields (Unused in unified engine, handled by normalization).
 * @param {Object} options - Multi-copy options.
 * @returns {Promise<Buffer>}
 */
const generateReceiptVoucherPDF = async (dataItems, user, title = "RECEIPT VOUCHER", labels = {}, options = { original: true }) => {
    // Ensure data is array
    const documents = Array.isArray(dataItems) ? dataItems : [dataItems];

    // Determine docType from title
    const docType = title.includes('PAYMENT') ? 'Payment' : 'Receipt';

    // Resolve print config (falling back to business-wide settings)
    const printConfig = await fetchAndResolveDocumentOptions(user.userId, docType);

    return generateSaleInvoicePDF(
        documents,
        user,
        options,
        docType,
        printConfig
    );
};

module.exports = { generateReceiptVoucherPDF };
