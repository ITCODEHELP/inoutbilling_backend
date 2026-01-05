const express = require('express');
const router = express.Router();
const {
    getCurrentMembership,
    getAvailablePlans,
    initiateUpgrade,
    getPaymentHistory,
    seedMembershipPlans
} = require('../controllers/membershipController');
const { protect } = require('../middlewares/authMiddleware');

// Internal setup
router.post('/seed-plans', seedMembershipPlans);

router.use(protect);

router.get('/current', getCurrentMembership);
router.get('/plans', getAvailablePlans);
router.post('/upgrade', initiateUpgrade);
router.get('/payments', getPaymentHistory);

module.exports = router;
