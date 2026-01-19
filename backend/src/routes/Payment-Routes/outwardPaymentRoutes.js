const express = require('express');
const router = express.Router();
const {
    createOutwardPayment,
    getOutwardPayments,
    getOutwardPaymentById,
    updateOutwardPayment,
    cancelOutwardPayment,
    deleteOutwardPayment,
    attachFilesOutwardPayment,
    duplicateOutwardPayment,
    getPaymentSummary,
    searchOutwardPayments,
    downloadPaymentPDF,
    shareEmail,
    shareWhatsApp,
    generatePublicLink,
    viewPaymentPublic
} = require('../../controllers/Payment-Controller/outwardPaymentController');
const { saveCustomField, getCustomFields } = require('../../controllers/Payment-Controller/outwardPaymentCustomFieldController');
const { protect } = require('../../middlewares/authMiddleware');

// Custom Fields
router.post('/custom-fields', protect, saveCustomField);
router.get('/custom-fields', protect, getCustomFields);

// Main Module
router.get('/search', protect, searchOutwardPayments);
router.get('/summary', protect, getPaymentSummary);
router.get('/:id/download', protect, downloadPaymentPDF);
router.get('/:id/print', protect, downloadPaymentPDF);
router.post('/:id/share-email', protect, shareEmail);
router.post('/:id/share-whatsapp', protect, shareWhatsApp);
router.get('/:id/public-link', protect, generatePublicLink);

// Public View
router.get('/view-public/:id/:token', viewPaymentPublic);

router.post('/', protect, createOutwardPayment);
router.get('/', protect, getOutwardPayments);
router.get('/:id', protect, getOutwardPaymentById);
router.put('/:id', protect, updateOutwardPayment);
router.put('/:id/cancel', protect, cancelOutwardPayment);
router.delete('/:id', protect, deleteOutwardPayment);
router.post('/:id/attach', protect, attachFilesOutwardPayment);
router.post('/:id/duplicate', protect, duplicateOutwardPayment);

module.exports = router;
