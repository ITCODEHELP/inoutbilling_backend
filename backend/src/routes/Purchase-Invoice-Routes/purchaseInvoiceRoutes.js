const express = require('express');
const router = express.Router();
const PurchaseInvoiceController = require('../../controllers/Purchase-Invoice-Controller/purchaseInvoiceController');
const { protect } = require('../../middlewares/authMiddleware');
const invoiceAttachment = require('../../middlewares/invoiceAttachmentMiddleware');

// Create
router.post('/create', protect, invoiceAttachment.array('attachments', 5), PurchaseInvoiceController.createPurchaseInvoice);
router.post('/create-print', protect, invoiceAttachment.array('attachments', 5), PurchaseInvoiceController.createPurchaseInvoiceAndPrint);

// List & Search
router.get('/', protect, PurchaseInvoiceController.getPurchaseInvoices);
router.get('/search', protect, PurchaseInvoiceController.getPurchaseInvoices); // Same as list with query params

// Summary
router.get('/summary', protect, PurchaseInvoiceController.getPurchaseSummary);
router.get('/summary-by-category', protect, PurchaseInvoiceController.getSummaryByCategory);

// Single Doc Operations
router.get('/:id', protect, PurchaseInvoiceController.getPurchaseInvoiceById);
router.put('/:id', protect, invoiceAttachment.array('attachments', 5), PurchaseInvoiceController.updatePurchaseInvoice);
router.delete('/:id', protect, PurchaseInvoiceController.deletePurchaseInvoice);

// Actions
router.get('/:id/download', protect, PurchaseInvoiceController.downloadPurchaseInvoicePDF);
router.post('/:id/share-email', protect, PurchaseInvoiceController.shareEmail);
router.post('/:id/share-whatsapp', protect, PurchaseInvoiceController.shareWhatsApp);
router.post('/:id/duplicate', protect, PurchaseInvoiceController.duplicatePurchaseInvoice);
router.post('/:id/cancel', protect, PurchaseInvoiceController.cancelPurchaseInvoice);
router.post('/:id/attach', protect, invoiceAttachment.array('attachments', 5), PurchaseInvoiceController.attachFileToPurchaseInvoice);
router.post('/:id/generate-barcode', protect, PurchaseInvoiceController.generateBarcodeForPurchaseInvoice);

// E-Way Bill
router.post('/:id/eway-bill', protect, PurchaseInvoiceController.generateEWayBill);
router.get('/:id/eway-bill/json', protect, PurchaseInvoiceController.downloadEWayBillJson);

// Conversions
router.post('/:id/convert/quotation', protect, PurchaseInvoiceController.convertToQuotation);
router.post('/:id/convert/sale-invoice', protect, PurchaseInvoiceController.convertToSaleInvoice);
router.post('/:id/convert/credit-note', protect, PurchaseInvoiceController.convertToCreditNote);
router.post('/:id/convert/debit-note', protect, PurchaseInvoiceController.convertToDebitNote);
router.post('/:id/convert/purchase-order', protect, PurchaseInvoiceController.convertToPurchaseOrder);

module.exports = router;
