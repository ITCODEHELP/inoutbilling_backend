const express = require('express');
const router = express.Router();
const documentOptionController = require('../../controllers/Setting-Page-Controller/documentOptionController');
const { protect } = require('../../middlewares/authMiddleware');

router.get('/', protect, documentOptionController.getDocumentOptions);
router.post('/', protect, documentOptionController.saveDocumentOptions);

module.exports = router;
