const express = require('express');
const router = express.Router();
const { searchDocuments } = require('../controllers/goDriveController');
const { protect } = require('../middlewares/authMiddleware');

router.get('/search', protect, searchDocuments);

module.exports = router;
