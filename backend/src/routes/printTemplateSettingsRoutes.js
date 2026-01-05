const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
    getDocumentTypes,
    getAvailableTemplates,
    saveTemplateSettings,
    getTemplateSettings,
    getDocumentTemplateConfig
} = require('../controllers/printTemplateSettingsController');

// @route   GET /api/print-template-settings/document-types
// @desc    Get all document types
// @access  Private
router.get('/document-types', protect, getDocumentTypes);

// @route   GET /api/print-template-settings/templates
// @desc    Get all available templates
// @access  Private
router.get('/templates', protect, getAvailableTemplates);

// @route   GET /api/print-template-settings/document/:documentType
// @desc    Get template configuration for a specific document type
// @access  Private
router.get('/document/:documentType', protect, getDocumentTemplateConfig);

// @route   POST /api/print-template-settings
// @desc    Save or Update template settings
// @access  Private
router.post('/', protect, saveTemplateSettings);

// @route   GET /api/print-template-settings
// @desc    Get saved template settings
// @access  Private
router.get('/', protect, getTemplateSettings);

module.exports = router;
