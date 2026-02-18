const express = require('express');
const router = express.Router();
const SalesReportController = require('../../controllers/Report-Controller/salesReportController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @route   POST /api/reports/sales
 * @desc    Generate sales report with filters and customization
 * @access  Private
 * @param   {Object} req.body - Request body containing filters and options
 * @param   {Object} req.body.filters - Filter criteria
 * @param   {string} req.body.filters.customerVendor - Customer/Vendor name
 * @param   {Array} req.body.filters.products - Array of product names
 * @param   {Array} req.body.filters.productGroup - Array of product groups
 * @param   {Object} req.body.filters.dateRange - Date range with from/to properties
 * @param   {string} req.body.filters.staffName - Staff name
 * @param   {string} req.body.filters.invoiceNumber - Invoice number
 * @param   {string} req.body.filters.invoiceSeries - Invoice series/prefix
 * @param   {string} req.body.filters.serialNumber - Serial number
 * @param   {boolean} req.body.filters.includeCancelled - Include cancelled invoices
 * @param   {boolean} req.body.filters.groupByCustomer - Group by customer
 * @param   {boolean} req.body.filters.groupByCurrency - Group by original currency
 * @param   {Array} req.body.filters.advanceFilters - Advanced dynamic filters
 * @param   {Array} req.body.filters.selectedColumns - Selected columns for output
 * @param   {Object} req.body.options - Query options
 * @param   {number} req.body.options.page - Page number (default: 1)
 * @param   {number} req.body.options.limit - Records per page (default: 50)
 * @param   {string} req.body.options.sortBy - Sort field (default: invoiceDetails.date)
 * @param   {string} req.body.options.sortOrder - Sort order: 'asc' or 'desc' (default: 'desc')
 * @returns {Object} Sales report data with pagination
 */
router.post('/sales', protect, SalesReportController.generateSalesReport);

/**
 * @route   POST /api/reports/sales/print
 * @desc    Generate HTML for printing
 * @access  Private
 */
router.post('/sales/print', protect, SalesReportController.printSalesReport);

/**
 * @route   POST /api/reports/sales/download
 * @desc    Download Sales Report PDF
 * @access  Private
 */
router.post('/sales/download', protect, SalesReportController.downloadSalesReportPdf);

/**
 * @route   POST /api/reports/sales/export
 * @desc    Export Sales Report to Excel
 * @access  Private
 */
router.post('/sales/export', protect, SalesReportController.exportSalesReportExcel);

/**
 * @route   POST /api/reports/sales/email
 * @desc    Email Sales Report PDF
 * @access  Private
 */
router.post('/sales/email', protect, SalesReportController.emailSalesReport);

/**
 * @route   GET /api/reports/sales/metadata
 * @desc    Get available filter fields and column options
 * @access  Private
 * @returns {Object} Available filters, columns, and operators
 */
router.get('/sales/metadata', protect, SalesReportController.getFilterMetadata);

/** 
 * @route   POST /api/reports/sales/statistics
 * @desc    Get report statistics (dashboard data)
 * @access  Private
 * @param   {Object} req.body.filters - Optional filter criteria
 * @returns {Object} Report statistics
 */
router.post('/sales/statistics', protect, SalesReportController.getReportStatistics);

module.exports = router;
