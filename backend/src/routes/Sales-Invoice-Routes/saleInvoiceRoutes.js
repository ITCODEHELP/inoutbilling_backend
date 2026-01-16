const express = require('express');
const router = express.Router();
const SaleInvoiceController = require('../../controllers/Sales-Invoice-Controller/saleInvoiceController');
const { protect } = require('../../middlewares/authMiddleware');
const invoiceAttachment = require('../../middlewares/invoiceAttachmentMiddleware');

// Create new invoice with attachments
router.post('/create', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.createInvoice);

// Create and print invoice with attachments
router.post('/create-print', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.createInvoiceAndPrint);

// Get summary
router.get('/summary', protect, SaleInvoiceController.getInvoiceSummary);

// Search Invoices
router.get('/search', protect, SaleInvoiceController.searchInvoices);

// Get all invoices
router.get('/', protect, SaleInvoiceController.getInvoices);

// Get single invoice by ID
router.get('/:id', protect, SaleInvoiceController.getInvoiceById);

// Download PDF
router.get('/:id/download', protect, SaleInvoiceController.downloadInvoicePDF);

// Share via Email
router.post('/:id/share-email', protect, SaleInvoiceController.shareEmail);

// Share via WhatsApp
router.post('/:id/share-whatsapp', protect, SaleInvoiceController.shareWhatsApp);

// Share via SMS
router.post('/:id/share-sms', protect, SaleInvoiceController.shareSMS);

// Delete invoice
router.delete('/:id', protect, SaleInvoiceController.deleteInvoice);

module.exports = router;
