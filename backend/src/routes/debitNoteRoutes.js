const express = require('express');
const router = express.Router();
const {
    createDebitNote,
    getDebitNotes,
    getDebitNoteById,
    updateDebitNote,
    deleteDebitNote,
    searchDebitNotes,
    getDebitNoteSummary
} = require('../controllers/debitNoteController');
const { protect } = require('../middlewares/authMiddleware');

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

module.exports = router;
