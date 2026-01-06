const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const upload = require('../middlewares/expenseUploadMiddleware');
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
    printExpense
} = require('../controllers/dailyExpenseController');
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
    .post(protect, (req, res, next) => {
        upload.single('attachment')(req, res, (err) => {
            if (err) {
                return next(err);
            }
            next();
        });
    }, createExpense)
    .get(protect, listExpenses);

router.get('/search', protect, searchExpenses);
router.get('/summary', protect, getExpenseSummary);
router.post('/import', protect, memoryUpload.single('file'), importExpenses);
router.get('/import-history', protect, getImportHistory);
router.get('/:id/print', protect, printExpense);

module.exports = router;
