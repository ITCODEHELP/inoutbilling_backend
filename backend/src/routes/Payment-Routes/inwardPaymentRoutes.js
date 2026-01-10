const express = require('express');
const router = express.Router();
const { createInwardPayment, getInwardPayments, getPaymentSummary, searchInwardPayments } = require('../../controllers/Payment-Controller/inwardPaymentController');
const { saveCustomField, getCustomFields } = require('../../controllers/Payment-Controller/inwardPaymentCustomFieldController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/custom-fields', protect, saveCustomField);
router.get('/custom-fields', protect, getCustomFields);

router.get('/search', protect, searchInwardPayments);
router.get('/summary', protect, getPaymentSummary);
router.post('/', protect, createInwardPayment);
router.get('/', protect, getInwardPayments);

module.exports = router;
