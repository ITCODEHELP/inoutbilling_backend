const express = require('express');
const router = express.Router();
const { createVendor, getVendors, getVendorById } = require('../controllers/vendorController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.post('/create', createVendor);
router.get('/', getVendors);
router.get('/:id', getVendorById);

module.exports = router;
