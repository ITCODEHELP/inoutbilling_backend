const express = require('express');
const router = express.Router();
const { saveTemplates, getTemplates } = require('../../controllers/Setting-Page-Controller/messageTemplateSettingsController');
const { protect } = require('../../middlewares/authMiddleware');

router.post('/', protect, saveTemplates);
router.get('/', protect, getTemplates);

module.exports = router;
