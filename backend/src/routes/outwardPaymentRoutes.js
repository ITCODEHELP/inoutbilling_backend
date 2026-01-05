const express = require('express');
const router = express.Router();
const { createOutwardPayment, getOutwardPayments, getPaymentSummary, searchOutwardPayments } = require('../controllers/outwardPaymentController');
const { saveCustomField, getCustomFields } = require('../controllers/outwardPaymentCustomFieldController');
const { protect } = require('../middlewares/authMiddleware');

// Custom Fields
router.post('/custom-fields', protect, saveCustomField);
router.get('/custom-fields', protect, getCustomFields);

// Main Module
router.get('/search', protect, searchOutwardPayments);
router.get('/summary', protect, getPaymentSummary);
router.post('/', protect, createOutwardPayment);
router.get('/', protect, getOutwardPayments);

module.exports = router;
