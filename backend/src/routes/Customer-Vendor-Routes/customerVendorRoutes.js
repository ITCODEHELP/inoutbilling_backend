const express = require('express');
const router = express.Router();
const { createCustomerVendor, getCustomerVendors, gstAutofill, ewayBillAutofill, searchParties } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.post('/create', createCustomerVendor);
router.get('/', getCustomerVendors);
router.get('/search-all', searchParties);

// Auto-fill Routes (GET)
router.get('/gst-autofill/:gstin', gstAutofill);
router.get('/ewaybill-autofill/:ewayBillNo', ewayBillAutofill);

// Auto-fill Routes (POST)
router.post('/gst-autofill', gstAutofill);
router.post('/ewaybill-autofill', ewayBillAutofill);

module.exports = router;
