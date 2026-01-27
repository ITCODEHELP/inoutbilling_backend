const express = require('express');
const router = express.Router();
const {
    createJobWork,
    getJobWorks,
    getJobWorkById,
    updateJobWork,
    deleteJobWork,
    getJobWorkSummary,
    searchJobWorks,
    updateJobWorkStatus,
    getJobWorkRemainingQty,
    convertJWToChallanData,
    convertJWToInvoiceData,
    convertJWToSaleOrderData,
    convertJWToQuotationData,
    getDuplicateJobWorkData,
    attachJobWorkFile,
    getJobWorkAttachments,
    updateJobWorkAttachment,
    deleteJobWorkAttachment,
    printJobWork,
    downloadJobWorkPDF,
    shareJobWorkEmail,
    shareJobWorkWhatsApp,
    generateJobWorkPublicLink,
    viewJobWorkPublic
} = require('../../controllers/Other-Document-Controller/jobWorkController');
const { protect } = require('../../middlewares/authMiddleware');
const jobWorkAttachment = require('../../middlewares/jobWorkAttachmentMiddleware');

// Public routes
router.get('/view-public/:id/:token', viewJobWorkPublic);

router.use(protect);

router.get('/summary', getJobWorkSummary);
router.get('/search', searchJobWorks);

router.route('/')
    .get(getJobWorks)
    .post(createJobWork);

router.route('/:id')
    .get(getJobWorkById)
    .put(updateJobWork)
    .delete(deleteJobWork);

router.get('/:id/convert-to-challan', convertJWToChallanData);
router.get('/:id/convert-to-invoice', convertJWToInvoiceData);
router.get('/:id/convert-to-sale-order', convertJWToSaleOrderData);
router.get('/:id/convert-to-quotation', convertJWToQuotationData);
router.get('/:id/duplicate', getDuplicateJobWorkData);
router.get('/:id/remaining-quantity', getJobWorkRemainingQty);

// PDF & Sharing Routes
router.get('/:id/print', printJobWork);
router.get('/:id/download-pdf', downloadJobWorkPDF);
router.post('/:id/share-email', shareJobWorkEmail);
router.post('/:id/share-whatsapp', shareJobWorkWhatsApp);
router.get('/:id/public-link', generateJobWorkPublicLink);

router.patch('/:id/status', updateJobWorkStatus);

// Attachment Routes
router.post('/:id/attach-file', jobWorkAttachment.array('attachments', 10), attachJobWorkFile);
router.get('/:id/attachments', getJobWorkAttachments);
router.put('/:id/attachment/:attachmentId', jobWorkAttachment.single('attachment'), updateJobWorkAttachment);
router.delete('/:id/attachment/:attachmentId', deleteJobWorkAttachment);

module.exports = router;
