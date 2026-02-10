const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { getSelectedPrintTemplate } = require('./documentHelper');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Generates a Daily Expense PDF by delegating to the unified Sale Invoice PDF engine.
 * @param {Object} data - Expense data.
 * @param {Object} user - Company details.
 * @returns {Promise<Buffer>}
 */
const generateDailyExpensePDF = async (data, user, options = { original: true }) => {
    // Ensure data is array
    const documents = Array.isArray(data) ? data : [data];

    // Resolve print config (falling back to business-wide settings)
    const userId = user._id || user.userId;
    const printConfig = await getSelectedPrintTemplate(userId, 'Daily Expense');

    // Also fetch document-specific options (labels, etc.)
    const docOptions = await fetchAndResolveDocumentOptions(userId, 'Daily Expense');

    // Merge them
    const finalConfig = { ...docOptions, ...printConfig };

    return generateSaleInvoicePDF(
        documents,
        user,
        options,
        'Daily Expense',
        finalConfig
    );
};

module.exports = { generateDailyExpensePDF };
