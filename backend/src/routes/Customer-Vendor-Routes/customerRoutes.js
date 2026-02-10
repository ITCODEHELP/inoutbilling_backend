const express = require('express');
const router = express.Router();
const {
    downloadCustomers,
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../../controllers/Customer-Vendor-Controller/customerController');
const { gstAutofill, ewayBillAutofill } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

// Helper route to download customers excel
router.get('/download-customers', downloadCustomers);

// Auto-fill Routes
router.get('/gst-autofill/:gstin', protect, gstAutofill);
router.post('/gst-autofill', protect, gstAutofill);
router.get('/ewaybill-autofill/:ewayBillNo', protect, ewayBillAutofill);
router.post('/ewaybill-autofill', protect, ewayBillAutofill);

// CRUD Routes
// CRUD Routes
router.post('/', protect, createCustomer);
router.get('/', protect, getCustomers);
router.get('/:id', protect, getCustomerById);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);

module.exports = router;
