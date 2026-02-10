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
    downloadDebitNotePDF,
    shareDebitNoteEmail,
    shareDebitNoteWhatsApp,
    generateDebitNotePublicLink,
    viewPublicDebitNote
} = require('../../controllers/Other-Document-Controller/debitNoteController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.get('/search', searchDebitNotes);
router.get('/summary', getDebitNoteSummary);

router.route('/')
    .get(getDebitNotes)
    .post(createDebitNote);

router.get('/download-pdf/:id', downloadDebitNotePDF);
router.post('/share-email/:id', shareDebitNoteEmail);
router.post('/share-whatsapp/:id', shareDebitNoteWhatsApp);
router.get('/public-link/:id', generateDebitNotePublicLink);
router.get('/view-public/:id/:token', viewPublicDebitNote);

router.route('/:id')
    .get(getDebitNoteById)
    .put(updateDebitNote)
    .delete(deleteDebitNote);

module.exports = router;
