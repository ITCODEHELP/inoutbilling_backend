const PaymentReminderSettings = require('../../models/Setting-Model/PaymentReminderSetting');

/**
 * @desc    Save Payment Reminder Settings
 * @route   POST /api/payment-reminder-settings
 * @access  Private
 */
const saveSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const updateData = req.body;

        // Find existing settings
        let settingsDoc = await PaymentReminderSettings.findOne({ userId });

        if (!settingsDoc) {
            // Create new if not exists
            settingsDoc = await PaymentReminderSettings.create({
                userId,
                ...updateData
            });
        } else {
            // Update only provided keys
            if (updateData.email_reminder_enabled !== undefined) {
                settingsDoc.email_reminder_enabled = updateData.email_reminder_enabled;
            }
            if (updateData.whatsapp_reminder_enabled !== undefined) {
                settingsDoc.whatsapp_reminder_enabled = updateData.whatsapp_reminder_enabled;
            }
            await settingsDoc.save();
        }

        res.status(200).json({
            success: true,
            message: "Payment reminder settings updated successfully"
        });

    } catch (error) {
        console.error("Error saving payment reminder settings:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get Payment Reminder Settings
 * @route   GET /api/payment-reminder-settings
 * @access  Private
 */
const getSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const settingsDoc = await PaymentReminderSettings.findOne({ userId });

        if (settingsDoc) {
            res.status(200).json({
                email_reminder_enabled: settingsDoc.email_reminder_enabled,
                whatsapp_reminder_enabled: settingsDoc.whatsapp_reminder_enabled
            });
        } else {
            // Default false if not set
            res.status(200).json({
                email_reminder_enabled: false,
                whatsapp_reminder_enabled: false
            });
        }
    } catch (error) {
        console.error("Error fetching payment reminder settings:", error);
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
