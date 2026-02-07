const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates a Job Work PDF by delegating to the unified Sale Invoice PDF engine.
 * @param {Object|Array} documents - Single or Multiple Job Work documents.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {Object} options - Multi-copy options.
 * @returns {Promise<Buffer>}
 */
const generateJobWorkPDF = async (documents, user, options = { original: true }) => {
    // Ensure data is array
    const docList = Array.isArray(documents) ? documents : [documents];

    // Resolve print config (falling back to business-wide settings)
    const printConfig = await fetchAndResolveDocumentOptions(user.userId, 'Job Work');

    return generateSaleInvoicePDF(
        docList,
        user,
        options,
        'Job Work',
        printConfig
    );
};

module.exports = { generateJobWorkPDF };
