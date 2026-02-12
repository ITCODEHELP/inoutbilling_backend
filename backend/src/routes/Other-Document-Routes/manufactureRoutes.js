const express = require('express');
const router = express.Router();
const {
    createManufacture,
    getManufactures,
    getManufactureById,
    updateManufacture,
    searchManufactures,
    deleteManufacture,
    downloadManufacturePDF,
    shareManufactureEmail,
    shareManufactureWhatsApp,
    generateManufacturePublicLink,
    viewPublicManufacture
} = require('../../controllers/Other-Document-Controller/manufactureController');
const { protect } = require('../../middlewares/authMiddleware');

// Public Link (Unprotected)
router.get('/view-public/:id/:token', viewPublicManufacture);

router.use(protect);

router.get('/search', searchManufactures);

router.route('/')
    .get(getManufactures)
    .post(createManufacture);

router.route('/:id')
    .get(getManufactureById)
    .put(updateManufacture)
    .delete(deleteManufacture);

// PDF and Sharing

router.get('/:id/download-pdf', downloadManufacturePDF);
router.post('/:id/share-email', shareManufactureEmail);
router.post('/:id/share-whatsapp', shareManufactureWhatsApp);
router.get('/:id/public-link', generateManufacturePublicLink);



module.exports = router;
