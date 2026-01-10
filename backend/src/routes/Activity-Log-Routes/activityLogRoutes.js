const express = require('express');
const router = express.Router();
const { getActivityLogs } = require('../../controllers/Activity-Log-Controller/activityLogController');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/', protect, getActivityLogs);

module.exports = router;
