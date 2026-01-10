const express = require('express');
const router = express.Router();
const {
    addToBarcodeCart,
    getBarcodeCart,
    removeFromBarcodeCart,
    generateBarcodes,
    getBarcodeHistory
} = require('../../controllers/Product-Service-Controller/barcodeGenerateController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.post('/cart', addToBarcodeCart);
router.get('/cart', getBarcodeCart);
router.delete('/cart/:id', removeFromBarcodeCart);
router.post('/generate', generateBarcodes);
router.get('/history', getBarcodeHistory);

module.exports = router;
