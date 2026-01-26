const express = require('express');
const router = express.Router();
const {
    createSaleOrder,
    getSaleOrders,
    getSaleOrderSummary,
    getSaleOrderById,
    updateSaleOrder,
    deleteSaleOrder,
    searchSaleOrders,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    updateSaleOrderStatus,
    getSaleOrderRemainingQty,
    convertSOToChallanData,
    convertSOToInvoiceData,
    convertSOToProformaData,
    convertSOToPurchaseOrderData,
    getDuplicateSOData,
    cancelSaleOrder,
    restoreSaleOrder,
    attachSaleOrderFile,
    getSaleOrderAttachments,
    updateSaleOrderAttachment,
    deleteSaleOrderAttachment,
    printSaleOrder,
    downloadSaleOrderPDF,
    shareSaleOrderEmail,
    shareSaleOrderWhatsApp,
    generatePublicLink,
    viewSaleOrderPublic
} = require('../../controllers/Other-Document-Controller/saleOrderController');
const { protect } = require('../../middlewares/authMiddleware');
const saleOrderAttachment = require('../../middlewares/saleOrderAttachmentMiddleware');

// Public routes
router.get('/view-public/:id/:token', viewSaleOrderPublic);

// Sale Order Main Routes
router.route('/')
    .get(protect, getSaleOrders)
    .post(protect, createSaleOrder);

router.get('/search', protect, searchSaleOrders);
router.get('/summary', protect, getSaleOrderSummary);

router.route('/:id')
    .get(protect, getSaleOrderById)
    .put(protect, updateSaleOrder)
    .delete(protect, deleteSaleOrder);

router.patch('/:id/status', protect, updateSaleOrderStatus);
router.get('/:id/remaining-quantity', protect, getSaleOrderRemainingQty);
router.get('/:id/convert-to-challan', protect, convertSOToChallanData);
router.get('/:id/convert-to-invoice', protect, convertSOToInvoiceData);
router.get('/:id/convert-to-proforma', protect, convertSOToProformaData);
router.get('/:id/convert-to-purchase-order', protect, convertSOToPurchaseOrderData);
router.get('/:id/duplicate', protect, getDuplicateSOData);
router.post('/:id/cancel', protect, cancelSaleOrder);
router.post('/:id/restore', protect, restoreSaleOrder);

// PDF & Sharing Routes
router.get('/:id/print', protect, printSaleOrder);
router.get('/:id/download-pdf', protect, downloadSaleOrderPDF);
router.post('/:id/share-email', protect, shareSaleOrderEmail);
router.post('/:id/share-whatsapp', protect, shareSaleOrderWhatsApp);
router.get('/:id/public-link', protect, generatePublicLink);

// Attachment Routes
router.post('/:id/attach-file', protect, saleOrderAttachment.array('attachments', 10), attachSaleOrderFile);
router.get('/:id/attachments', protect, getSaleOrderAttachments);
router.put('/:id/attachment/:attachmentId', protect, saleOrderAttachment.single('attachment'), updateSaleOrderAttachment);
router.delete('/:id/attachment/:attachmentId', protect, deleteSaleOrderAttachment);

// Custom Field Routes
router.route('/custom-fields')
    .get(protect, getCustomFields)
    .post(protect, createCustomField);

router.route('/custom-fields/:id')
    .put(protect, updateCustomField)
    .delete(protect, deleteCustomField);

// Item Column Routes
router.route('/item-columns')
    .get(protect, getItemColumns)
    .post(protect, createItemColumn);

router.route('/item-columns/:id')
    .put(protect, updateItemColumn)
    .delete(protect, deleteItemColumn);

module.exports = router;
