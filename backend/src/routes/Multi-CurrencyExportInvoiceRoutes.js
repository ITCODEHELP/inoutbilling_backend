const express = require('express');
const router = express.Router();
const {
    createExportInvoice,
    getExportInvoices,
    getExportInvoiceById,
    updateExportInvoice,
    deleteExportInvoice,
    searchExportInvoices,
    getExportInvoiceSummary
} = require('../controllers/Multi-CurrencyExportInvoiceController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/search', searchExportInvoices);
router.get('/summary', getExportInvoiceSummary);

router.route('/')
    .get(getExportInvoices)
    .post(createExportInvoice);

router.route('/:id')
    .get(getExportInvoiceById)
    .put(updateExportInvoice)
    .delete(deleteExportInvoice);

module.exports = router;

