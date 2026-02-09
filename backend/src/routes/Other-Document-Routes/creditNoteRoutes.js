const express = require('express');
const router = express.Router();
const {
    createCreditNote,
    getCreditNotes,
    getCreditNoteById,
    updateCreditNote,
    deleteCreditNote,
    searchCreditNotes,
    getCreditNoteSummary,
    getDuplicateCreditNoteData,
    cancelCreditNote,
    restoreCreditNote,
    downloadCreditNotePDF,
    shareCreditNoteEmail,
    shareCreditNoteWhatsApp,
    generateCreditNotePublicLink,
    viewPublicCreditNote,
    attachCreditNoteFile,
    getCreditNoteAttachments,
    updateCreditNoteAttachment,
    deleteCreditNoteAttachment
} = require('../../controllers/Other-Document-Controller/creditNoteController');
const { protect } = require('../../middlewares/authMiddleware');
const creditNoteAttachment = require('../../middlewares/creditNoteAttachmentMiddleware');

// Public View Route (Unprotected)
router.get('/view-public/:id/:token', viewPublicCreditNote);

router.use(protect);

router.get('/search', searchCreditNotes);
router.get('/summary', getCreditNoteSummary);

router.route('/')
    .get(getCreditNotes)
    .post(createCreditNote);

router.route('/:id')
    .get(getCreditNoteById)
    .put(updateCreditNote)
    .delete(deleteCreditNote);

// Actions
router.post('/:id/cancel', cancelCreditNote);
router.post('/:id/restore', restoreCreditNote);

// PDF and Sharing
router.get('/:id/duplicate', getDuplicateCreditNoteData);
router.get('/:id/download-pdf', downloadCreditNotePDF);
router.post('/:id/share-email', shareCreditNoteEmail);
router.post('/:id/share-whatsapp', shareCreditNoteWhatsApp);
router.get('/:id/public-link', generateCreditNotePublicLink);

// Attachments
router.post('/:id/attach-file', creditNoteAttachment.array('attachments', 10), attachCreditNoteFile);
router.get('/:id/attachments', getCreditNoteAttachments);
router.put('/:id/attachment/:attachmentId', creditNoteAttachment.single('attachment'), updateCreditNoteAttachment);
router.delete('/:id/attachment/:attachmentId', deleteCreditNoteAttachment);

module.exports = router;
