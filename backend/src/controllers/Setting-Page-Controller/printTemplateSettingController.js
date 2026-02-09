const PrintTemplateSettings = require('../../models/Setting-Model/PrintTemplateSetting');

// Document types available in the system
const DOCUMENT_TYPES = [
    'Sale Invoice',
    'Delivery Challan',
    'Quotation',
    'Proforma',
    'Purchase Order',
    'Sale Order',
    'Job Work',
    'Credit Note',
    'Debit Note',
    'Purchase Invoice',
    'Multi Currency Invoice',
    'Payment Receipt',
    'Daily Expense',
    'Other Income',
    'Letters',
    'Packing List'
];

// Available templates for each document type
const AVAILABLE_TEMPLATES = [
    { name: 'Default', category: 'standard', supportsPrintSettings: true },
    { name: 'Designed', category: 'standard', supportsPrintSettings: true },
    { name: 'Letterpad', category: 'standard', supportsPrintSettings: true },
    { name: 'Template-1', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-2', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-3', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-4', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-5', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-6', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-7', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-8', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-9', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-10', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-11', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-12', category: 'custom', supportsPrintSettings: false },
    { name: 'Template-13', category: 'custom', supportsPrintSettings: false },
    { name: 'A5-Default', category: 'a5', supportsPrintSettings: false },
    { name: 'A5-Designed', category: 'a5', supportsPrintSettings: false },
    { name: 'A5-Letterpad', category: 'a5', supportsPrintSettings: false },
    { name: 'Thermal-2inch', category: 'thermal', supportsPrintSettings: false },
    { name: 'Thermal-3inch', category: 'thermal', supportsPrintSettings: false }
];

/**
 * @desc    Get all document types
 * @route   GET /api/print-template-settings/document-types
 * @access  Private (JWT Protected)
 */
const getDocumentTypes = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Document types retrieved successfully',
            data: DOCUMENT_TYPES.map(type => ({
                documentType: type,
                displayName: type
            }))
        });
    } catch (error) {
        console.error('Error fetching document types:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch document types',
            error: error.message
        });
    }
};

/**
 * @desc    Get available templates for a document type
 * @route   GET /api/print-template-settings/templates
 * @access  Private (JWT Protected)
 */
const getAvailableTemplates = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Templates retrieved successfully',
            data: AVAILABLE_TEMPLATES
        });
    } catch (error) {
        console.error('Error fetching templates:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch templates',
            error: error.message
        });
    }
};

/**
 * @desc    Save or Update template selections for a branch
 * @route   POST /api/print-template-settings
 * @access  Private (JWT Protected)
 */
const saveTemplateSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { branchId = 'main', templateConfigurations } = req.body;

        // Validate input
        if (!templateConfigurations || !Array.isArray(templateConfigurations)) {
            return res.status(400).json({
                success: false,
                message: 'templateConfigurations array is required'
            });
        }

        // Validate each configuration
        for (const config of templateConfigurations) {
            if (!config.documentType || !config.selectedTemplate) {
                return res.status(400).json({
                    success: false,
                    message: 'Each configuration must have documentType and selectedTemplate'
                });
            }

            // Check if template is A5 or Thermal, printSize and printOrientation should not be provided
            // To be robust, we simply remove them if present instead of throwing an error
            const template = AVAILABLE_TEMPLATES.find(t => t.name === config.selectedTemplate);
            if (template && !template.supportsPrintSettings) {
                if (config.printSize) delete config.printSize;
                if (config.printOrientation) delete config.printOrientation;
            }
        }

        // Find existing settings or create new
        let settings = await PrintTemplateSettings.findOne({ userId, branchId });

        if (settings) {
            // Update existing settings
            settings.templateConfigurations = templateConfigurations;
            await settings.save();

            return res.status(200).json({
                success: true,
                message: 'Template settings updated successfully',
                data: settings
            });
        } else {
            // Create new settings
            settings = await PrintTemplateSettings.create({
                userId,
                branchId,
                templateConfigurations
            });

            return res.status(201).json({
                success: true,
                message: 'Template settings saved successfully',
                data: settings
            });
        }
    } catch (error) {
        console.error('Error saving template settings:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Settings already exist for this user and branch'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to save template settings',
            error: error.message
        });
    }
};

/**
 * @desc    Get saved template settings for a branch
 * @route   GET /api/print-template-settings
 * @access  Private (JWT Protected)
 */
const getTemplateSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const { branchId = 'main' } = req.query;

        const settings = await PrintTemplateSettings.findOne({ userId, branchId });

        if (!settings) {
            // Return empty configuration with default template for all document types
            return res.status(200).json({
                success: true,
                message: 'No saved settings found, returning defaults',
                data: {
                    userId,
                    branchId,
                    templateConfigurations: DOCUMENT_TYPES.map(docType => ({
                        documentType: docType,
                        selectedTemplate: 'Default',
                        printSize: 'A4',
                        printOrientation: 'Portrait'
                    }))
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Template settings retrieved successfully',
            data: settings
        });
    } catch (error) {
        console.error('Error fetching template settings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch template settings',
            error: error.message
        });
    }
};

/**
 * @desc    Get template configuration for a specific document type
 * @route   GET /api/print-template-settings/document/:documentType
 * @access  Private (JWT Protected)
 */
const getDocumentTemplateConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const { documentType } = req.params;
        const { branchId = 'main' } = req.query;

        // Validate document type
        if (!DOCUMENT_TYPES.includes(documentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid document type'
            });
        }

        const settings = await PrintTemplateSettings.findOne({ userId, branchId });

        if (!settings) {
            // Return default configuration
            return res.status(200).json({
                success: true,
                message: 'No saved settings found, returning default',
                data: {
                    documentType,
                    selectedTemplate: 'Default',
                    printSize: 'A4',
                    printOrientation: 'Portrait'
                }
            });
        }

        // Find configuration for this document type
        const config = settings.templateConfigurations.find(
            c => c.documentType === documentType
        );

        if (!config) {
            // Return default if not found
            return res.status(200).json({
                success: true,
                message: 'No configuration found for this document type, returning default',
                data: {
                    documentType,
                    selectedTemplate: 'Default',
                    printSize: 'A4',
                    printOrientation: 'Portrait'
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Template configuration retrieved successfully',
            data: config
        });
    } catch (error) {
        console.error('Error fetching document template config:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch template configuration',
            error: error.message
        });
    }
};

module.exports = {
    getDocumentTypes,
    getAvailableTemplates,
    saveTemplateSettings,
    getTemplateSettings,
    getDocumentTemplateConfig
};
