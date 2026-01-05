const express = require('express');
const router = express.Router();
const {
    createStaff,
    getStaffByName,
    getAllStaff
} = require('../controllers/staffController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/create', protect, createStaff);
router.get('/all', protect, getAllStaff);
router.get('/search/:name', protect, getStaffByName);

module.exports = router;
