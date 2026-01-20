const express = require('express');
const router = express.Router();
const {
    addToBarcodeCart,
    getBarcodeCart,
    removeFromBarcodeCart,
    generateBarcodes,
    getBarcodeHistory,
    downloadBarcodePDF,
    printBarcodePDF
} = require('../../controllers/Product-Service-Controller/barcodeGenerateController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.post('/cart', addToBarcodeCart);
router.get('/cart', getBarcodeCart);
router.delete('/cart/:id', removeFromBarcodeCart);
router.post('/generate', generateBarcodes);
router.get('/history', getBarcodeHistory);
router.get('/history/:id/download', downloadBarcodePDF);
router.get('/history/:id/print', printBarcodePDF);

module.exports = router;
