const express = require('express');
const router = express.Router();
const SaleInvoiceController = require('../../controllers/Sales-Invoice-Controller/saleInvoiceController');
const { protect } = require('../../middlewares/authMiddleware');
const invoiceAttachment = require('../../middlewares/invoiceAttachmentMiddleware');

// Create
router.post('/create', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.createInvoice);
router.post('/resolve-item', protect, SaleInvoiceController.resolveInvoiceItem);
router.post('/create-dynamic', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.createDynamicInvoice);
router.post('/create-print', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.createInvoiceAndPrint);

// List & Search
router.get('/', protect, SaleInvoiceController.getInvoices);
router.get('/search', protect, SaleInvoiceController.searchInvoices);

// Summary
router.get('/summary', protect, SaleInvoiceController.getInvoiceSummary);

// Single Doc Operations
router.get('/:id', protect, SaleInvoiceController.getInvoiceById);
router.put('/:id', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.updateInvoice);
router.delete('/:id', protect, SaleInvoiceController.deleteInvoice);

// Actions
router.get('/:id/download', protect, SaleInvoiceController.downloadInvoicePDF);
router.post('/:id/share-email', protect, SaleInvoiceController.shareEmail);
router.post('/:id/share-whatsapp', protect, SaleInvoiceController.shareWhatsApp);
router.post('/:id/share-sms', protect, SaleInvoiceController.shareSMS);
router.post('/:id/duplicate', protect, SaleInvoiceController.duplicateInvoice);
router.post('/:id/cancel', protect, SaleInvoiceController.cancelInvoice);
router.post('/:id/attach', protect, invoiceAttachment.array('attachments', 5), SaleInvoiceController.attachFileToInvoice);
router.post('/:id/generate-barcode', protect, SaleInvoiceController.generateBarcodeForInvoice);

// E-Way Bill
router.post('/:id/eway-bill', protect, SaleInvoiceController.generateEWayBill);
router.get('/:id/eway-bill/json', protect, SaleInvoiceController.downloadEWayBillJson);

// Conversions
router.post('/:id/convert/delivery-challan', protect, SaleInvoiceController.convertToDeliveryChallan);
router.post('/:id/convert/proforma', protect, SaleInvoiceController.convertToProformaInvoice);
router.post('/:id/convert/quotation', protect, SaleInvoiceController.convertToQuotation);
router.post('/:id/convert/credit-note', protect, SaleInvoiceController.convertToCreditNote);
router.post('/:id/convert/debit-note', protect, SaleInvoiceController.convertToDebitNote);
router.post('/:id/convert/purchase-invoice', protect, SaleInvoiceController.convertToPurchaseInvoice);
router.post('/:id/convert/packing-list', protect, SaleInvoiceController.convertToPackingList);

module.exports = router;
