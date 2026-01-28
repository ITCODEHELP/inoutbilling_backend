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
    getLetterProducts,
    getLetterTemplate,
    createLetterFromTemplate,
    downloadLetterPDF,
    shareLetterEmail,
    shareLetterWhatsApp,
    generateLetterPublicLink,
    viewLetterPublic
} = require('../../controllers/Other-Document-Controller/letterController');
const { protect } = require('../../middlewares/authMiddleware');

// Public route (no auth required)
router.get('/view-public/:id/:token', viewLetterPublic);

// Check for protect middleware existence - assuming it exists as per instructions and existing patterns
router.use(protect);

router.get('/search', searchLetters);

router.route('/')
    .get(getLetters)
    .post(createLetter);

router.get('/template/:templateType', getLetterTemplate);
router.post('/template/:templateType', createLetterFromTemplate);



router.post('/resolve-content', resolveBlockContent);

router.get('/entities/customers', getLetterCustomers);
router.get('/entities/vendors', getLetterVendors);
router.get('/entities/all', getLetterAllEntities);
router.get('/entities/products', getLetterProducts);

router.route('/:id')
    .get(getLetterById)
    .put(updateLetter)
    .delete(deleteLetter);

// Letter actions
router.get('/:id/download', downloadLetterPDF);
router.post('/:id/share-email', shareLetterEmail);
router.post('/:id/share-whatsapp', shareLetterWhatsApp);
router.post('/:id/generate-link', generateLetterPublicLink);

router.patch('/:id/blocks/:blockId/move', moveLetterBlock);
router.delete('/:id/blocks/:blockId', deleteLetterBlock);

module.exports = router;
