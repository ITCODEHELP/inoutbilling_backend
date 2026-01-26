const express = require('express');
const router = express.Router();
const {
    createQuotation,
    getQuotations,
    getQuotationSummary,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    printQuotation,
    downloadQuotationPDF,
    shareQuotationEmail,
    shareQuotationWhatsApp,
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
    convertToProformaData,
    convertToChallanData,
    convertToPurchaseOrderData,
    attachQuotationFile,
    getQuotationAttachments,
    updateQuotationAttachment,
    deleteQuotationAttachment,
    generatePublicLink,
    viewQuotationPublic,
    getDuplicateQuotationData
} = require('../../controllers/Other-Document-Controller/quotationController');
const { protect } = require('../../middlewares/authMiddleware');
const quotationAttachment = require('../../middlewares/quotationAttachmentMiddleware');

router.get('/view-public/:id/:token', viewQuotationPublic); // Public route

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

// Quotation Routes
router.get('/summary', getQuotationSummary);

router.route('/')
    .get(getQuotations)
    .post(createQuotation);

router.route('/:id')
    .get(getQuotationById)
    .put(updateQuotation)
    .delete(deleteQuotation);

router.get('/:id/print', printQuotation);
router.get('/:id/download-pdf', downloadQuotationPDF);
router.post('/:id/share-email', shareQuotationEmail);
router.post('/:id/share-whatsapp', shareQuotationWhatsApp);
router.get('/:id/public-link', generatePublicLink);
router.get('/:id/convert-to-invoice', convertToSaleInvoiceData);
router.get('/:id/convert-to-purchase-invoice', convertToPurchaseInvoiceData);
router.get('/:id/convert-to-proforma', convertToProformaData);
router.get('/:id/convert-to-challan', convertToChallanData);
router.get('/:id/convert-to-purchase-order', convertToPurchaseOrderData);
router.get('/:id/duplicate', getDuplicateQuotationData);

// Attachment Routes
router.post('/:id/attach-file', protect, quotationAttachment.array('attachments', 10), attachQuotationFile);
router.get('/:id/attachments', protect, getQuotationAttachments);
router.put('/:id/attachment/:attachmentId', protect, quotationAttachment.single('attachment'), updateQuotationAttachment);
router.delete('/:id/attachment/:attachmentId', protect, deleteQuotationAttachment);

module.exports = router;
