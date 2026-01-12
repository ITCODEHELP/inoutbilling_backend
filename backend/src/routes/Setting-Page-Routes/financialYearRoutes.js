const express = require('express');
const router = express.Router();
const {
    getAllFinancialYears,
    getActiveFinancialYear,
    setActiveFinancialYear
} = require('../../controllers/Setting-Page-Controller/FinancialYearController');
const { protect } = require('../../middlewares/authMiddleware');

// Get all available financial years
router.get('/years', protect, getAllFinancialYears);

// Get current active financial year for user context
router.get('/', protect, getActiveFinancialYear);

// Update/Set active financial year
router.patch('/', protect, setActiveFinancialYear);

module.exports = router;
