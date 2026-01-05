const express = require('express');
const router = express.Router();
const {
    saveCustomFields,
    getCustomFields
} = require('../controllers/purchaseInvoiceCustomFieldController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/', protect, saveCustomFields);
router.get('/', protect, getCustomFields);

module.exports = router;
