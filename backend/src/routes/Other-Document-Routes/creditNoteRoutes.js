const express = require('express');
const router = express.Router();
const {
    createCreditNote,
    getCreditNotes,
    getCreditNoteById,
    updateCreditNote,
    deleteCreditNote,
    searchCreditNotes,
    getCreditNoteSummary
} = require('../../controllers/Other-Document-Controller/creditNoteController');
const { protect } = require('../../middlewares/authMiddleware');

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

module.exports = router;
