const express = require('express');
const router = express.Router();
const {
    createInvoice,
    createInvoiceAndPrint,
    getInvoices,
    getInvoiceById,
    deleteInvoice,
    getInvoiceSummary
} = require('../controllers/saleInvoiceController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/create', createInvoice);
router.post('/create-print', createInvoiceAndPrint);
router.get('/summary', getInvoiceSummary);
router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.delete('/:id', deleteInvoice);

module.exports = router;
