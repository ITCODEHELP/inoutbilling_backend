const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationSummary,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    printQuotation,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../../controllers/Other-Document-Controller/quotationController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

// Custom Fields Routes
router.route('/custom-fields')
    .get(getCustomFields)
    .post(createCustomField);

router.route('/custom-fields/:id')
    .put(updateCustomField)
    .delete(deleteCustomField);

// Item Columns Routes
router.route('/item-columns')
    .get(getItemColumns)
    .post(createItemColumn);

router.route('/item-columns/:id')
    .put(updateItemColumn)
    .delete(deleteItemColumn);

// Quotation Routes
router.get('/summary', getQuotationSummary);

router.route('/')
    .get(getQuotations)
    .post(createQuotation);

router.route('/:id')
    .get(getQuotationById)
    .put(updateQuotation)
    .delete(deleteQuotation);

router.get('/:id/print', printQuotation);

module.exports = router;
