const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates a Purchase Invoice PDF by delegating to the unified Sale Invoice PDF engine.
 * @param {Object|Array} invoices - Single or Multiple Purchase Invoice documents.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {Object} options - Multi-copy options.
 * @returns {Promise<Buffer>}
 */
const generatePurchaseInvoicePDF = async (invoices, user, options = { original: true }) => {
    // Ensure data is array
    const documents = Array.isArray(invoices) ? invoices : [invoices];

    // Resolve print config (falling back to business-wide settings)
    const printConfig = await fetchAndResolveDocumentOptions(user.userId, 'Purchase Invoice');

    return generateSaleInvoicePDF(
        documents,
        user,
        options,
        'Purchase Invoice',
        printConfig
    );
};

module.exports = { generatePurchaseInvoicePDF };
