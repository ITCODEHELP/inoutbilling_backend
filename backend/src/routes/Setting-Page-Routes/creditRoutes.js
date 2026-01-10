const express = require('express');
const router = express.Router();
const {
    getCreditBalance,
    getAvailablePacks,
    purchaseCredits,
    getUsageLog,
    getPaymentHistory,
    seedCreditData
} = require('../../controllers/Setting-Page-Controller/creditController');
const { protect } = require('../../middlewares/authMiddleware');

// Internal setup
router.post('/seed', seedCreditData);

router.use(protect);

router.get('/balance', getCreditBalance);
router.get('/packs', getAvailablePacks);
router.post('/purchase', purchaseCredits);
router.get('/logs', getUsageLog);
router.get('/payments', getPaymentHistory);

module.exports = router;
