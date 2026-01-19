const express = require('express');
const router = express.Router();
const { createVendor, getVendors, getVendorById, updateVendor, deleteVendor } = require('../../controllers/Customer-Vendor-Controller/vendorController');
const { gstAutofill, ewayBillAutofill } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect); // Ensure all routes are protected

// Auto-fill Routes
router.get('/gst-autofill/:gstin', gstAutofill);
router.post('/gst-autofill', gstAutofill);
router.get('/ewaybill-autofill/:ewayBillNo', ewayBillAutofill);
router.post('/ewaybill-autofill', ewayBillAutofill);

router.post('/create', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);
router.put('/:id', updateVendor);
router.delete('/:id', deleteVendor);

module.exports = router;
