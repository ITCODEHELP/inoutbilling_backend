const express = require('express');
const router = express.Router();
const {
    createExportInvoice,
    getExportInvoices,
    getExportInvoiceById,
    updateExportInvoice,
    deleteExportInvoice,
    searchExportInvoices,
    getExportInvoiceSummary,
    getDuplicateExportInvoiceData,
    cancelExportInvoice,
    restoreExportInvoice,
    downloadExportInvoicePDF,
    shareExportInvoiceEmail,
    shareExportInvoiceWhatsApp,
    generateExportInvoicePublicLink,
    viewPublicExportInvoice,
    printExportInvoice,
    attachExportInvoiceFile,
    getExportInvoiceAttachments,
    updateExportInvoiceAttachment,
    deleteExportInvoiceAttachment
} = require('../../controllers/Other-Document-Controller/Multi-CurrencyExportInvoiceController');
const { protect } = require('../../middlewares/authMiddleware');
const exportInvoiceAttachment = require('../../middlewares/exportInvoiceAttachmentMiddleware');

// Public View Route (Unprotected)
router.get('/view-public/:id/:token', viewPublicExportInvoice);

router.use(protect);

router.get('/search', searchExportInvoices);
router.get('/summary', getExportInvoiceSummary);

router.route('/')
    .get(getExportInvoices)
    .post(createExportInvoice);

router.route('/:id')
    .get(getExportInvoiceById)
    .put(updateExportInvoice)
    .delete(deleteExportInvoice);

// Actions
router.post('/:id/cancel', cancelExportInvoice);
router.post('/:id/restore', restoreExportInvoice);

// PDF and Sharing
router.get('/:id/duplicate', getDuplicateExportInvoiceData);
router.get('/:id/download-pdf', downloadExportInvoicePDF);
router.get('/:id/print', printExportInvoice);
router.post('/:id/share-email', shareExportInvoiceEmail);
router.post('/:id/share-whatsapp', shareExportInvoiceWhatsApp);
router.get('/:id/public-link', generateExportInvoicePublicLink);

// Attachments
router.post('/:id/attach-file', exportInvoiceAttachment.array('attachments', 10), attachExportInvoiceFile);
router.get('/:id/attachments', getExportInvoiceAttachments);
router.put('/:id/attachment/:attachmentId', exportInvoiceAttachment.single('attachment'), updateExportInvoiceAttachment);
router.delete('/:id/attachment/:attachmentId', deleteExportInvoiceAttachment);

module.exports = router;

