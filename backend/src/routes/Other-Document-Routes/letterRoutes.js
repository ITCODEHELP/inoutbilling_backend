const express = require('express');
const router = express.Router();
const {
    createLetter,
    getLetters,
    getLetterById,
    updateLetter,
    deleteLetter,
    searchLetters
} = require('../../controllers/Other-Document-Controller/letterController');
const { protect } = require('../../middlewares/authMiddleware');

// Check for protect middleware existence - assuming it exists as per instructions and existing patterns
router.use(protect);

router.get('/search', searchLetters);

router.route('/')
    .get(getLetters)
    .post(createLetter);

router.route('/:id')
    .get(getLetterById)
    .put(updateLetter)
    .delete(deleteLetter);

module.exports = router;
