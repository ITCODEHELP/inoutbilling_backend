const express = require('express');
const router = express.Router();
const {
    createStaff,
    getStaffByName,
    getAllStaff,
    updateStaff,
    deleteStaff,
    staffLogin
} = require('../../controllers/Setting-Page-Controller/staffController');
const { protect } = require('../../middlewares/authMiddleware');

// Owner-protected routes
router.post('/create', protect, createStaff);
router.get('/all', protect, getAllStaff);
router.get('/search/:name', protect, getStaffByName);
router.put('/:id', protect, updateStaff);
router.delete('/:id', protect, deleteStaff);

// Public staff login route (does not use owner auth)
router.post('/login', staffLogin);

module.exports = router;
