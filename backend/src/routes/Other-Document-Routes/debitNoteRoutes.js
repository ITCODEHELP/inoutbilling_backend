const express = require('express');
const router = express.Router();
const {
    createDebitNote,
    getDebitNotes,
    getDebitNoteById,
    updateDebitNote,
    deleteDebitNote,
    searchDebitNotes,
    getDebitNoteSummary,
    getDuplicateDebitNoteData,
    cancelDebitNote,
    restoreDebitNote,
    downloadDebitNotePDF,
    shareDebitNoteEmail,
    shareDebitNoteWhatsApp,
    generateDebitNotePublicLink,
    viewPublicDebitNote,
    attachDebitNoteFile,
    getDebitNoteAttachments,
    updateDebitNoteAttachment,
    deleteDebitNoteAttachment
} = require('../../controllers/Other-Document-Controller/debitNoteController');
const { protect } = require('../../middlewares/authMiddleware');
const debitNoteAttachment = require('../../middlewares/debitNoteAttachmentMiddleware');

// Public View Route (Unprotected)
router.get('/view-public/:id/:token', viewPublicDebitNote);

router.use(protect);

router.get('/search', searchDebitNotes);
router.get('/summary', getDebitNoteSummary);

router.route('/')
    .get(getDebitNotes)
    .post(createDebitNote);

router.route('/:id')
    .get(getDebitNoteById)
    .put(updateDebitNote)
    .delete(deleteDebitNote);

// Actions
router.post('/:id/cancel', cancelDebitNote);
router.post('/:id/restore', restoreDebitNote);

// PDF and Sharing
router.get('/:id/duplicate', getDuplicateDebitNoteData);
router.get('/:id/download-pdf', downloadDebitNotePDF);
router.post('/share-email/:id', shareDebitNoteEmail);
router.post('/share-whatsapp/:id', shareDebitNoteWhatsApp);
router.get('/public-link/:id', generateDebitNotePublicLink);

// Attachments
router.post('/:id/attach-file', debitNoteAttachment.array('attachments', 10), attachDebitNoteFile);
router.get('/:id/attachments', getDebitNoteAttachments);
router.put('/:id/attachment/:attachmentId', debitNoteAttachment.single('attachment'), updateDebitNoteAttachment);
router.delete('/:id/attachment/:attachmentId', deleteDebitNoteAttachment);

module.exports = router;
