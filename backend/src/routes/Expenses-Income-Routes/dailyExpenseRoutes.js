const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const upload = require('../../middlewares/expenseUploadMiddleware');
const {
    createExpense,
    listExpenses,
    searchExpenses,
    getExpenseSummary,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    importExpenses,
    getImportHistory,
    printExpense,
    attachFile,
    deleteAttachment,
    getAttachment,
    downloadExpensePDF,
    shareExpenseEmail,
    shareExpenseWhatsApp,
    generatePublicLink,
    viewExpensePublic
} = require('../../controllers/Expenses-Income-Controller/dailyExpensesController');
const multer = require('multer');
const memoryUpload = multer({ storage: multer.memoryStorage() });

// Custom Fields Routes
router.route('/custom-fields')
    .get(protect, getCustomFields)
    .post(protect, createCustomField);

router.route('/custom-fields/:id')
    .put(protect, updateCustomField)
    .delete(protect, deleteCustomField);

// Item Columns Routes
router.route('/item-columns')
    .get(protect, getItemColumns)
    .post(protect, createItemColumn);

router.route('/item-columns/:id')
    .put(protect, updateItemColumn)
    .delete(protect, deleteItemColumn);

// Expense Routes
router.route('/')
    .post(protect, upload.single('attachment'), createExpense)
    .get(protect, listExpenses);

router.get('/search', protect, searchExpenses);
router.get('/summary', protect, getExpenseSummary);
router.post('/import', protect, memoryUpload.single('file'), importExpenses);
router.get('/import-history', protect, getImportHistory);
router.get('/:id/print', protect, printExpense);

router.post('/attach-file', protect, upload.single('attachment'), attachFile);
router.delete('/attachment/:id', protect, deleteAttachment);
router.get('/attachment/:id', protect, getAttachment);
router.get('/:id/download-pdf', protect, downloadExpensePDF);
router.post('/:id/share-email', protect, shareExpenseEmail);
router.post('/:id/share-whatsapp', protect, shareExpenseWhatsApp);
router.get('/:id/public-link', protect, generatePublicLink);
router.get('/view-public/:id/:token', viewExpensePublic);

module.exports = router;
