const express = require('express');
const router = express.Router();
const {
    createProforma,
    getProformas,
    getProformaSummary,
    getProformaById,
    updateProforma,
    deleteProforma,
    printProforma,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../../controllers/Other-Document-Controller/proformaController');
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

// Proforma Routes
router.get('/summary', getProformaSummary);

router.route('/')
    .get(getProformas)
    .post(createProforma);

router.route('/:id')
    .get(getProformaById)
    .put(updateProforma)
    .delete(deleteProforma);

router.get('/:id/print', printProforma);

module.exports = router;
