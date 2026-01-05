const express = require('express');
const router = express.Router();
const {
    saveProductCustomColumn,
    getProductCustomColumns
} = require('../controllers/productCustomColumnController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, saveProductCustomColumn);
router.get('/', protect, getProductCustomColumns);

module.exports = router;
