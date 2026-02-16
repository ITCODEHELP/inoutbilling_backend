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
    deleteItemColumn,
    updateDeliveryChallanNote,
    generateLabel,
    convertToSaleInvoice,
    convertToSaleInvoiceData,
    convertToPurchaseInvoiceData,
    cancelDeliveryChallan,
    restoreDeliveryChallan,
    uploadAttachment,
    getAttachments,
    deleteAttachment,
    downloadDeliveryChallansPDF,
    shareDeliveryChallanEmail,
    shareDeliveryChallanWhatsApp,
    generatePublicLink,
    viewDeliveryChallanPublic,
    getDuplicateChallanData
} = require('../../controllers/Other-Document-Controller/deliveryChallanController');
const upload = require('../../middlewares/entityDocumentUploadMiddleware');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/view-public/:id/:token', viewDeliveryChallanPublic);

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

router.patch('/:id/note', updateDeliveryChallanNote);

router.get('/:id/label', generateLabel);
router.get('/:id/duplicate', getDuplicateChallanData);

router.post('/:id/convert-to-sale-invoice', convertToSaleInvoice);
router.get('/:id/convert-to-invoice', convertToSaleInvoiceData);
router.get('/:id/convert-to-purchase-invoice', convertToPurchaseInvoiceData);

router.put('/:id/cancel', cancelDeliveryChallan);
router.put('/:id/restore', restoreDeliveryChallan);

router.post('/:id/attachments', upload.single('attachment'), uploadAttachment);
router.get('/:id/attachments', getAttachments);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

router.get('/download/:id', downloadDeliveryChallansPDF);
router.post('/share-email/:id', shareDeliveryChallanEmail);
router.post('/share-whatsapp/:id', shareDeliveryChallanWhatsApp);
router.get('/:id/public-link', generatePublicLink);

router.get('/:id/print', printDeliveryChallan);

module.exports = router;