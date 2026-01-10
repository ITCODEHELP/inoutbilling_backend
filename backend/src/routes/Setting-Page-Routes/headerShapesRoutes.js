const express = require('express');
const router = express.Router();
const { getHeaderShapes } = require('../../controllers/Setting-Page-Controller/headerShapesController');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/', protect, getHeaderShapes);

module.exports = router;
