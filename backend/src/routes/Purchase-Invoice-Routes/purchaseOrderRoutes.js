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
    deleteItemColumn,
    updatePurchaseOrderStatus,
    getPurchaseOrderRemainingQty,
    generatePOLabel,
    convertPOToPurchaseInvoiceData,
    convertPOToChallanData,
    getDuplicatePOData,
    cancelPurchaseOrder,
    restorePurchaseOrder,
    attachPurchaseOrderFile,
    getPurchaseOrderAttachments,
    updatePurchaseOrderAttachment,
    deletePurchaseOrderAttachment,
    printPurchaseOrder,
    downloadPurchaseOrderPDF,
    sharePurchaseOrderEmail,
    sharePurchaseOrderWhatsApp,
    generatePublicLink,
    viewPurchaseOrderPublic
} = require('../../controllers/Purchase-Invoice-Controller/purchaseOrderController');
const { protect } = require('../../middlewares/authMiddleware');
const purchaseOrderAttachment = require('../../middlewares/purchaseOrderAttachmentMiddleware');

// Public routes
router.get('/view-public/:id/:token', viewPurchaseOrderPublic);

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

router.route('/:id/status')
    .patch(updatePurchaseOrderStatus);

router.route('/:id/remaining-quantity')
    .get(getPurchaseOrderRemainingQty);

router.get('/:id/label', generatePOLabel);
router.get('/:id/print', printPurchaseOrder);
router.get('/:id/download-pdf', downloadPurchaseOrderPDF);
router.post('/:id/share-email', sharePurchaseOrderEmail);
router.post('/:id/share-whatsapp', sharePurchaseOrderWhatsApp);
router.get('/:id/public-link', generatePublicLink);

router.route('/:id/convert-to-purchase-invoice')
    .get(convertPOToPurchaseInvoiceData);

router.get('/:id/convert-to-challan', convertPOToChallanData);

router.get('/:id/duplicate', getDuplicatePOData);

// Actions
router.post('/:id/cancel', cancelPurchaseOrder);
router.post('/:id/restore', restorePurchaseOrder);

// Attachments
router.post('/:id/attach-file', purchaseOrderAttachment.array('attachments', 10), attachPurchaseOrderFile);
router.get('/:id/attachments', getPurchaseOrderAttachments);
router.put('/:id/attachment/:attachmentId', purchaseOrderAttachment.single('attachment'), updatePurchaseOrderAttachment);
router.delete('/:id/attachment/:attachmentId', deletePurchaseOrderAttachment);

router.route('/:id')
    .get(getPurchaseOrderById)
    .put(updatePurchaseOrder)
    .delete(deletePurchaseOrder);

module.exports = router;
