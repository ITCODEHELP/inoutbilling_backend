const express = require('express');
const router = express.Router();
const {
    createIncome,
    getIncomes,
    getIncomeSummary,
    printIncome,
    importIncomes,
    downloadImportSample,
    getIncome,
    updateIncome,
    deleteIncome,
    downloadIncomePDF,
    shareIncomeEmail,
    shareIncomeWhatsApp,
    generatePublicLink,
    viewIncomePublic
} = require('../../controllers/Expenses-Income-Controller/otherIncomeController');
const {
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../../controllers/Expenses-Income-Controller/dailyExpensesController');
const multer = require('multer');
const memoryUpload = multer({ storage: multer.memoryStorage() });
const { protect } = require('../../middlewares/authMiddleware');

router.get('/import/sample', protect, downloadImportSample);

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

router.post('/', protect, createIncome);
router.get('/', protect, getIncomes);
router.get('/summary', protect, getIncomeSummary);
router.post('/import', protect, memoryUpload.single('file'), importIncomes);
router.route('/:id')
    .get(protect, getIncome)
    .put(protect, updateIncome)
    .delete(protect, deleteIncome);

router.get('/:id/print', protect, printIncome);
router.get('/:id/download-pdf', protect, downloadIncomePDF);
router.post('/:id/share-email', protect, shareIncomeEmail);
router.post('/:id/share-whatsapp', protect, shareIncomeWhatsApp);
router.get('/:id/public-link', protect, generatePublicLink);
router.get('/view-public/:id/:token', viewIncomePublic);

module.exports = router;
