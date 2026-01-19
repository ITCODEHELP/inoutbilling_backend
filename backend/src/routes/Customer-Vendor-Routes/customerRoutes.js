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
router.post('/', createCustomer);
router.get('/', getCustomers);
router.get('/:id', getCustomerById);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

module.exports = router;
