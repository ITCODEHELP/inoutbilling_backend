const MessageTemplateSettings = require('../models/MessageTemplateSettings');

/**
 * @desc    Save Message Templates
 * @route   POST /api/message-templates
 * @access  Private
 */
const saveTemplates = async (req, res) => {
    try {
        const userId = req.user._id;
        let updateData = req.body;

        // Find existing settings
        let settingsDoc = await MessageTemplateSettings.findOne({ userId });

        if (!settingsDoc) {
            // Create new if not exists
            settingsDoc = await MessageTemplateSettings.create({
                userId,
                templates: updateData
            });
        } else {
            // Deep merge logic to preserve existing keys/templates
            const mergeTemplates = (target, source) => {
                for (const key in source) {
                    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                        mergeTemplates(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
                return target;
            };

            let currentTemplates = settingsDoc.templates;
            currentTemplates = mergeTemplates(currentTemplates, updateData);

            settingsDoc.templates = currentTemplates;
            settingsDoc.markModified('templates');
            await settingsDoc.save();
        }

        res.status(200).json({
            success: true,
            message: "Templates detail updated successfully"
        });

    } catch (error) {
        console.error("Error saving message templates:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get Message Templates
 * @route   GET /api/message-templates
 * @access  Private
 */
const getTemplates = async (req, res) => {
    try {
        const userId = req.user._id;
        const settingsDoc = await MessageTemplateSettings.findOne({ userId });

        res.status(200).json(settingsDoc ? settingsDoc.templates : {});
    } catch (error) {
        console.error("Error fetching message templates:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    saveTemplates,
    getTemplates
};
