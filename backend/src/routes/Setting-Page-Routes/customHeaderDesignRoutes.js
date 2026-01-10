const express = require('express');
const router = express.Router();
const { saveDesign, getDesign, uploadImage } = require('../../controllers/Setting-Page-Controller/bankDetailController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/upload-image', protect, uploadImage);
router.post('/', protect, saveDesign);
router.get('/', protect, getDesign);

module.exports = router;
