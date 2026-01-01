const express = require('express');
const router = express.Router();
const {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
    getProductStats
} = require('../controllers/productController');
const { protect } = require('../middlewares/authMiddleware');

// Stats Route (MUST come before /:id)
router.get('/stats', protect, getProductStats);

// CRUD Routes
router.post('/', protect, createProduct);
router.get('/', protect, getProducts);
router.get('/:id', protect, getProductById);
router.put('/:id', protect, updateProduct);
router.delete('/:id', protect, deleteProduct);

module.exports = router;
