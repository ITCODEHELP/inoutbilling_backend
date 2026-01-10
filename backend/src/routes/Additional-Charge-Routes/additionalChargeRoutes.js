const express = require('express');
const router = express.Router();
const {
    createAdditionalCharge,
    getAllAdditionalCharges
} = require('../../controllers/Additional-Charge-Controller/additionalChargeController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/', protect, createAdditionalCharge);
router.get('/', protect, getAllAdditionalCharges);

module.exports = router;
