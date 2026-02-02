const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../../middlewares/authMiddleware');
const {
    getSampleBankStatement,
    importBankStatement,
    exportBankStatementExcel,
    exportBankStatementPDF
} = require('../../controllers/Bank-Statement-Controller/bankStatementController');

// Configure Multer for Memory Storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// @route   GET /api/bank-statements/sample
// @desc    Get sample Excel file
// @access  Private
router.get('/sample', protect, getSampleBankStatement);

// @route   POST /api/bank-statements/import
// @desc    Import bank statement
// @access  Private
router.post('/import', protect, upload.single('file'), importBankStatement);

// @route   GET /api/bank-statements/export/excel/:id
// @desc    Export bank statements to Excel
// @access  Private
router.get('/export/excel/:id', protect, exportBankStatementExcel);

// @route   GET /api/bank-statements/export/pdf/:id
// @desc    Export bank statements to PDF
// @access  Private
router.get('/export/pdf/:id', protect, exportBankStatementPDF);

module.exports = router;
