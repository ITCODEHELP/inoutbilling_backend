const express = require('express');
const router = express.Router();
const { createVendor, getVendors, getVendorById } = require('../../controllers/Customer-Vendor-Controller/vendorController');
const { gstAutofill, ewayBillAutofill } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

// router.use(protect);
// Note: router.use(protect) was removed to unprotect these routes.

// Auto-fill Routes
router.get('/gst-autofill/:gstin', gstAutofill);
router.post('/gst-autofill', gstAutofill);
router.get('/ewaybill-autofill/:ewayBillNo', ewayBillAutofill);
router.post('/ewaybill-autofill', ewayBillAutofill);

router.post('/create', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);

module.exports = router;
