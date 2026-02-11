const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { getSelectedPrintTemplate } = require('./documentHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates an Other Income PDF by delegating to the unified Sale Invoice PDF engine.
 * @param {Object|Array} data - Income data or array of income data.
 * @param {Object} user - Company details.
 * @param {Object} options - Copy selection.
 * @returns {Promise<Buffer>}
 */
const generateOtherIncomePDF = async (data, user, options = { original: true }) => {
    // Ensure data is array
    const documents = Array.isArray(data) ? data : [data];

    // Resolve print config (falling back to business-wide settings)
    const userId = user._id || user.userId;
    const printConfig = await getSelectedPrintTemplate(userId, 'Other Income');

    // Also fetch document-specific options (labels, etc.)
    const docOptions = await fetchAndResolveDocumentOptions(userId, 'Other Income');

    // Merge them
    const finalConfig = { ...docOptions, ...printConfig };

    return generateSaleInvoicePDF(
        documents,
        user,
        options,
        'Other Income',
        finalConfig
    );
};

module.exports = { generateOtherIncomePDF };
