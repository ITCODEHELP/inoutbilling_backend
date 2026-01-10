const express = require('express');
const router = express.Router();
const {
    createSaleOrder,
    getSaleOrders,
    getSaleOrderSummary,
    getSaleOrderById,
    updateSaleOrder,
    deleteSaleOrder,
    searchSaleOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../../controllers/Other-Document-Controller/saleOrderController');
const { protect } = require('../../middlewares/authMiddleware');

// Sale Order Main Routes
router.route('/')
    .get(protect, getSaleOrders)
    .post(protect, createSaleOrder);

router.get('/search', protect, searchSaleOrders);
router.get('/summary', protect, getSaleOrderSummary);

router.route('/:id')
    .get(protect, getSaleOrderById)
    .put(protect, updateSaleOrder)
    .delete(protect, deleteSaleOrder);

// Custom Field Routes
router.route('/custom-fields')
    .get(protect, getCustomFields)
    .post(protect, createCustomField);

router.route('/custom-fields/:id')
    .put(protect, updateCustomField)
    .delete(protect, deleteCustomField);

// Item Column Routes
router.route('/item-columns')
    .get(protect, getItemColumns)
    .post(protect, createItemColumn);

router.route('/item-columns/:id')
    .put(protect, updateItemColumn)
    .delete(protect, deleteItemColumn);

module.exports = router;
