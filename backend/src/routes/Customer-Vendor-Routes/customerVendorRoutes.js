const express = require('express');
const router = express.Router();
const { createCustomerVendor, getCustomerVendors, gstAutofill, ewayBillAutofill, searchParties } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const {
    createCustomerVendor,
    getCustomerVendors,
    gstAutofill,
    ewayBillAutofill,
    getLedgerReport,
    printLedgerPDF,
    emailLedgerPDF
} = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.post('/create', createCustomerVendor);
router.get('/', getCustomerVendors);
router.get('/search-all', searchParties);

// Ledger Routes
router.get('/ledger', getLedgerReport);
router.get('/ledger/print', printLedgerPDF);
router.post('/ledger/email', emailLedgerPDF);

// Document Management Routes
const {
    uploadDocument,
    listDocuments,
    deleteDocument
} = require('../../controllers/Customer-Vendor-Controller/entityDocumentController');
const upload = require('../../middlewares/entityDocumentUploadMiddleware');

router.post('/documents/upload', upload.single('file'), uploadDocument);
router.get('/documents/:entityRef', listDocuments);
router.delete('/documents/delete/:documentId', deleteDocument);

// Auto-fill Routes (GET)
router.get('/gst-autofill/:gstin', gstAutofill);
router.get('/ewaybill-autofill/:ewayBillNo', ewayBillAutofill);

// Auto-fill Routes (POST)
router.post('/gst-autofill', gstAutofill);
router.post('/ewaybill-autofill', ewayBillAutofill);

module.exports = router;
