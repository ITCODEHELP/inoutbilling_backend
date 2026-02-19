const express = require('express');
const router = express.Router();
const ReportActionController = require('../../controllers/Report-Controller/ReportActionController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @route   POST /api/reports/action/print
 * @desc    Generate HTML for printing any report
 * @access  Private
 * @body    { reportType, filters, options, columns, reportTitle }
 */
router.post('/action/print', protect, ReportActionController.printReport);

/**
 * @route   POST /api/reports/action/pdf
 * @desc    Download PDF for any report
 * @access  Private
 * @body    { reportType, filters, options, columns, reportTitle }
 */
router.post('/action/pdf', protect, ReportActionController.downloadPdf);

/**
 * @route   POST /api/reports/action/excel
 * @desc    Download Excel for any report
 * @access  Private
 * @body    { reportType, filters, options, columns, reportTitle }
 */
router.post('/action/excel', protect, ReportActionController.downloadExcel);

/**
 * @route   POST /api/reports/action/email
 * @desc    Email PDF for any report
 * @access  Private
 * @body    { reportType, filters, options, columns, reportTitle, email, message }
 */
router.post('/action/email', protect, ReportActionController.emailReport);

module.exports = router;
