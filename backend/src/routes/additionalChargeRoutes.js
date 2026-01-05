const express = require('express');
const router = express.Router();
const {
    createAdditionalCharge,
    getAllAdditionalCharges
} = require('../controllers/additionalChargeController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, createAdditionalCharge);
router.get('/', protect, getAllAdditionalCharges);

module.exports = router;
