const express = require('express');
const router = express.Router();
const SalesOutstandingReportController = require('../../controllers/Report-Controller/SalesOutstandingReportController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @route   POST /api/reports/sales-outstanding
 * @desc    Generate sales outstanding report with filters and customization
 * @access  Private
 * @param   {Object} req.body - Request body containing filters and options
 * @param   {Object} req.body.filters - Filter criteria
 * @param   {string} req.body.filters.customerVendor - Customer/Vendor name
 * @param   {Array} req.body.filters.productGroup - Array of product groups
 * @param   {string} req.body.filters.invoiceNumber - Invoice number
 * @param   {string} req.body.filters.invoiceSeries - Invoice series/prefix
 * @param   {Object} req.body.filters.dueDateRange - Due date range with from/to properties
 * @param   {Object} req.body.filters.dueDaysRange - Due days range with from/to properties
 * @param   {boolean} req.body.filters.includePaid - Include paid invoices
 * @param   {boolean} req.body.filters.groupByDueDays - Group by due days
 * @param   {boolean} req.body.filters.groupByCustomer - Group by customer
 * @param   {boolean} req.body.filters.groupByCurrency - Group by original currency
 * @param   {Array} req.body.filters.advanceFilters - Advanced dynamic filters
 * @param   {Array} req.body.filters.selectedColumns - Selected columns for output
 * @param   {Object} req.body.options - Query options
 * @param   {number} req.body.options.page - Page number (default: 1)
 * @param   {number} req.body.options.limit - Records per page (default: 50)
 * @param   {string} req.body.options.sortBy - Sort field (default: 'invoiceDetails.date')
 * @param   {string} req.body.options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
 * @returns {Object} Sales outstanding report data with pagination
 */
router.post('/sales-outstanding', protect, SalesOutstandingReportController.generateOutstandingReport);

/**
 * @route   GET /api/reports/sales-outstanding/metadata
 * @desc    Get available filter fields and column options for outstanding report
 * @access  Private
 * @returns {Object} Available filters, columns, operators, and grouping options
 */
router.get('/sales-outstanding/metadata', protect, SalesOutstandingReportController.getFilterMetadata);

/**
 * @route   POST /api/reports/sales-outstanding/statistics
 * @desc    Get outstanding report statistics for dashboard
 * @access  Private
 * @param   {Object} req.body.filters - Optional filter criteria
 * @returns {Object} Outstanding statistics including totals and overdue analysis
 */
router.post('/sales-outstanding/statistics', protect, SalesOutstandingReportController.getOutstandingStatistics);

module.exports = router;
