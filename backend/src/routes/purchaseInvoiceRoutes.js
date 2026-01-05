const express = require('express');
const router = express.Router();
const {
    createPurchaseInvoice,
    createPurchaseInvoiceAndPrint,
    getAllPurchaseInvoices,
    getPurchaseInvoiceById,
    deletePurchaseInvoice,
    getPurchaseInvoiceSummary,
    searchPurchaseInvoices
} = require('../controllers/purchaseInvoiceController');
const { uploadInvoiceAI, confirmExtraction } = require('../controllers/purchaseInvoiceAIController');
const { protect } = require('../middlewares/authMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

router.get('/summary', getPurchaseInvoiceSummary);
router.get('/search', searchPurchaseInvoices);
router.post('/create', createPurchaseInvoice);
router.post('/create-print', createPurchaseInvoiceAndPrint);
router.post('/upload-ai', upload.single('invoice'), uploadInvoiceAI);
router.post('/confirm-ai', confirmExtraction);
router.get('/', getAllPurchaseInvoices);
router.get('/:id', getPurchaseInvoiceById);
router.delete('/:id', deletePurchaseInvoice);

module.exports = router;
