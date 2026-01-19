const express = require('express');
const router = express.Router();
const {
    createInwardPayment,
    getInwardPayments,
    getInwardPaymentById,
    updateInwardPayment,
    getPaymentSummary,
    searchInwardPayments,
    downloadPaymentPDF,
    shareEmail,
    shareWhatsApp,
    generatePublicLink,
    viewPaymentPublic
} = require('../../controllers/Payment-Controller/inwardPaymentController');
const { saveCustomField, getCustomFields } = require('../../controllers/Payment-Controller/inwardPaymentCustomFieldController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/custom-fields', protect, saveCustomField);
router.get('/custom-fields', protect, getCustomFields);

router.get('/search', protect, searchInwardPayments);
router.get('/summary', protect, getPaymentSummary);
router.post('/', protect, createInwardPayment);
router.get('/', protect, getInwardPayments);
router.get('/:id', protect, getInwardPaymentById);
router.put('/:id', protect, updateInwardPayment);

module.exports = router;
