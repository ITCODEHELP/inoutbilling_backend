const express = require('express');
const router = express.Router();
const {
    createCustomization,
    getCustomizations,
    getCustomizationById,
    updateCustomization,
    deleteCustomization
} = require('../controllers/barcodeCustomizationController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/customization', protect, createCustomization);
router.get('/customization', protect, getCustomizations);
router.get('/customization/:id', protect, getCustomizationById);
router.put('/customization/:id', protect, updateCustomization);
router.delete('/customization/:id', protect, deleteCustomization);

module.exports = router;
