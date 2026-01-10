const express = require('express');
const router = express.Router();
const { createCustomerVendor, getCustomerVendors } = require('../../controllers/Customer-Vendor-Controller/customerVendorController');
const { protect } = require('../../middlewares/authMiddleware');

router.use(protect);

router.post('/create', createCustomerVendor);
router.get('/', getCustomerVendors);

module.exports = router;
