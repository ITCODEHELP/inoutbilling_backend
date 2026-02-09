const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
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
    const printConfig = await fetchAndResolveDocumentOptions(user.userId, 'Daily Expense');

    return generateSaleInvoicePDF(
        documents,
        user,
        options,
        'Daily Expense',
        printConfig
    );
};

module.exports = { generateDailyExpensePDF };
