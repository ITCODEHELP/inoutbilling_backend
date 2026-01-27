const express = require('express');
const router = express.Router();
const {
    createLetter,
    getLetters,
    getLetterById,
    updateLetter,
    deleteLetter,
    searchLetters,
    moveLetterBlock,
    deleteLetterBlock,
    resolveBlockContent,
    getLetterCustomers,
    getLetterVendors,
    getLetterAllEntities,
    getLetterProducts
} = require('../../controllers/Other-Document-Controller/letterController');
const { protect } = require('../../middlewares/authMiddleware');

// Check for protect middleware existence - assuming it exists as per instructions and existing patterns
router.use(protect);

router.get('/search', searchLetters);

router.route('/')
    .get(getLetters)
    .post(createLetter);

router.post('/resolve-content', resolveBlockContent);

router.get('/entities/customers', getLetterCustomers);
router.get('/entities/vendors', getLetterVendors);
router.get('/entities/all', getLetterAllEntities);
router.get('/entities/products', getLetterProducts);

router.route('/:id')
    .get(getLetterById)
    .put(updateLetter)
    .delete(deleteLetter);

router.patch('/:id/blocks/:blockId/move', moveLetterBlock);
router.delete('/:id/blocks/:blockId', deleteLetterBlock);

module.exports = router;
