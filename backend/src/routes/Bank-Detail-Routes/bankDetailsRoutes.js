const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');
const { createBankDetails, updateBankDetails, getAllBankDetails, searchBankTransactions, addBankTransaction, updateBankTransaction, deleteBankTransaction } = require('../../controllers/Bank-Detail-Controller/bankDetailController');

// @route   POST /api/bank-details
// @desc    Create new bank details
// @access  Private
router.post('/', protect, createBankDetails);

// @route   GET /api/bank-details/transactions/search/:id
// @desc    Search bank transactions
// @access  Private
router.get('/transactions/search/:id', protect, searchBankTransactions);

// @route   POST /api/bank-details/transactions/:id
// @desc    Add new bank transaction
// @access  Private
router.post('/transactions/:id', protect, addBankTransaction);

// @route   PUT /api/bank-details/transactions/:id
// @desc    Update bank transaction
// @access  Private
router.put('/transactions/:id', protect, updateBankTransaction);

// @route   DELETE /api/bank-details/transactions/:id
// @desc    Delete bank transaction
// @access  Private
router.delete('/transactions/:id', protect, deleteBankTransaction);

// @route   PUT /api/bank-details/:id
// @desc    Update existing bank details
// @access  Private
router.put('/:id', protect, updateBankDetails);

// @route   GET /api/bank-details
// @desc    Get all bank accounts
// @access  Private
router.get('/', protect, getAllBankDetails);

module.exports = router;
