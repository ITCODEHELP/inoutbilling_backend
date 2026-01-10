const express = require('express');
const router = express.Router();
const SaleInvoiceController = require('../../controllers/Sales-Invoice-Controller/saleInvoiceController');
const { protect } = require('../../middlewares/authMiddleware');

// Create new invoice
router.post('/create', protect, SaleInvoiceController.createInvoice);

// Create and print invoice
router.post('/create-print', protect, SaleInvoiceController.createInvoiceAndPrint);

// Get summary
router.get('/summary', protect, SaleInvoiceController.getInvoiceSummary);

// Get all invoices
router.get('/', protect, SaleInvoiceController.getInvoices);

// Get single invoice by ID
router.get('/:id', protect, SaleInvoiceController.getInvoiceById);

// Delete invoice
router.delete('/:id', protect, SaleInvoiceController.deleteInvoice);

module.exports = router;
