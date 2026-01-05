const ShippingEnvelopeSettings = require('../models/ShippingEnvelopeSettings');

/**
 * @desc    Save Shipping & Envelope Settings
 * @route   POST /api/shipping-envelope-settings
 * @access  Private
 */
const saveSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        let updateData = req.body;

        // If body is empty, do nothing but return success as per requirement
        if (Object.keys(updateData).length === 0) {
            // Even if empty, ensure a record exists? 
            // Requirement says: "accept an empty {} payload without error, store only the provided keys, not overwrite existing values"
            // If record doesn't exist, an empty payload might imply creating a default empty record or doing nothing.
            // We'll proceed to finding/creating and then updating nothing.
        }

        // Find existing settings
        let settingsDoc = await ShippingEnvelopeSettings.findOne({ userId });

        if (!settingsDoc) {
            // Create new if not exists
            settingsDoc = await ShippingEnvelopeSettings.create({
                userId,
                settings: updateData
            });
        } else {
            // Merge existing settings with new data (Deep merge manually or use spread for top-level keys if structure is known)
            // Requirement: "store only the provided keys, not overwrite existing values when keys are missing"
            // Since we know the structure might be nested (shipping_options, envelope_options), we should care about those.

            // Helper function to merge objects recursively
            const mergeSettings = (target, source) => {
                for (const key in source) {
                    if (source[key] instanceof Object && key in target && target[key] instanceof Object) {
                        mergeSettings(target[key], source[key]);
                    } else {
                        target[key] = source[key];
                    }
                }
                return target;
            };

            // Current settings from DB
            let currentSettings = settingsDoc.settings;

            // Merge new data into current settings
            currentSettings = mergeSettings(currentSettings, updateData);

            // Update the document
            settingsDoc.settings = currentSettings;
            settingsDoc.markModified('settings'); // Tell Mongoose mixed type has changed
            await settingsDoc.save();
        }

        res.status(200).json({
            success: true,
            message: "Shipping & Envelope settings saved successfully"
        });

    } catch (error) {
        console.error("Error saving shipping settings:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get Shipping & Envelope Settings
 * @route   GET /api/shipping-envelope-settings
 * @access  Private
 */
const getSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const settingsDoc = await ShippingEnvelopeSettings.findOne({ userId });

        res.status(200).json(settingsDoc ? settingsDoc.settings : {});
    } catch (error) {
        console.error("Error fetching shipping settings:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    saveSettings,
    getSettings
};
