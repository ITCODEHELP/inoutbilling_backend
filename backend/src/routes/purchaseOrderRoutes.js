const express = require('express');
const router = express.Router();
const {
    createPurchaseOrder,
    getPurchaseOrders,
    getPurchaseOrderSummary,
    getPurchaseOrderById,
    updatePurchaseOrder,
    deletePurchaseOrder,
    searchPurchaseOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../controllers/purchaseOrderController');
const { protect } = require('../middlewares/authMiddleware');

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

// Purchase Order Routes
router.get('/search', searchPurchaseOrders);
router.get('/summary', getPurchaseOrderSummary);

router.route('/')
    .get(getPurchaseOrders)
    .post(createPurchaseOrder);

router.route('/:id')
    .get(getPurchaseOrderById)
    .put(updatePurchaseOrder)
    .delete(deletePurchaseOrder);

module.exports = router;
