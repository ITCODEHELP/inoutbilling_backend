const express = require('express');
const router = express.Router();
const {
    downloadCustomers,
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
} = require('../controllers/customerController');
const { protect } = require('../middlewares/authMiddleware');

// CRUD Routes
router.post('/', protect, createCustomer);
router.get('/', protect, getCustomers);
router.get('/:id', protect, getCustomerById);
router.put('/:id', protect, updateCustomer);
router.delete('/:id', protect, deleteCustomer);

// Helper route to download customers excel
router.get('/download-customers', downloadCustomers);

module.exports = router;
