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
    deleteItemColumn,
    convertToSaleInvoiceData,
    convertToPurchaseInvoiceData,
    convertToChallanData,
    convertToPurchaseOrderData,
    cancelProforma,
    restoreProforma,
    attachProformaFile,
    getProformaAttachments,
    updateProformaAttachment,
    deleteProformaAttachment,
    downloadProformaPDF,
    shareProformaEmail,
    shareProformaWhatsApp,
    generatePublicLink,
    viewPublicProforma
} = require('../../controllers/Other-Document-Controller/proformaController');
const { protect } = require('../../middlewares/authMiddleware');
const proformaAttachment = require('../../middlewares/proformaAttachmentMiddleware');

// Public View Route (Unprotected)
router.get('/view-public/:id/:token', viewPublicProforma);

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
router.get('/:id/download-pdf', downloadProformaPDF);
router.post('/:id/share-email', shareProformaEmail);
router.post('/:id/share-whatsapp', shareProformaWhatsApp);
router.get('/:id/public-link', generatePublicLink);

// Conversion Routes
router.get('/:id/convert-to-invoice', convertToSaleInvoiceData);
router.get('/:id/convert-to-purchase-invoice', convertToPurchaseInvoiceData);
router.get('/:id/convert-to-challan', convertToChallanData);
router.get('/:id/convert-to-purchase-order', convertToPurchaseOrderData);

// Actions
router.post('/:id/cancel', cancelProforma);
router.post('/:id/restore', restoreProforma);

// Attachments
router.post('/:id/attach-file', proformaAttachment.array('attachments', 10), attachProformaFile);
router.get('/:id/attachments', getProformaAttachments);
router.put('/:id/attachment/:attachmentId', proformaAttachment.single('attachment'), updateProformaAttachment);
router.delete('/:id/attachment/:attachmentId', deleteProformaAttachment);

module.exports = router;
