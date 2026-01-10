const express = require('express');
const router = express.Router();
const {
    createDeliveryChallan,
    getDeliveryChallans,
    getDeliveryChallanSummary,
    getDeliveryChallanById,
    updateDeliveryChallan,
    deleteDeliveryChallan,
    printDeliveryChallan,
    searchDeliveryChallans,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn
} = require('../../controllers/Other-Document-Controller/deliveryChallanController');
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

// Delivery Challan Routes
router.get('/search', searchDeliveryChallans);
router.get('/summary', getDeliveryChallanSummary);

router.route('/')
    .get(getDeliveryChallans)
    .post(createDeliveryChallan);

router.route('/:id')
    .get(getDeliveryChallanById)
    .put(updateDeliveryChallan)
    .delete(deleteDeliveryChallan);

router.get('/:id/print', printDeliveryChallan);

module.exports = router;
