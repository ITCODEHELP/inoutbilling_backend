const ShortcutKey = require('../../models/Setting-Model/ShortcutKey');
const UserShortcutPreference = require('../../models/Setting-Model/UserShortcutPreference');

/**
 * @desc    Fetch all available shortcut definitions (master configuration)
 * @route   GET /api/shortcuts/definitions
 * @access  Private
 */
const getShortcutDefinitions = async (req, res) => {
    try {
        let shortcuts = await ShortcutKey.find().sort({ moduleName: 1, actionLabel: 1 });

        // If no shortcuts found (e.g., initial setup), provide defaults or seed
        if (shortcuts.length === 0) {
            const defaults = ShortcutKey.getSeedData();
            shortcuts = await ShortcutKey.insertMany(defaults);
        }

        res.status(200).json({
            success: true,
            data: shortcuts
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Get current user's shortcut enable/disable preference
 * @route   GET /api/shortcuts/preference
 * @access  Private
 */
const getUserPreference = async (req, res) => {
    try {
        const userId = req.user._id;
        let preference = await UserShortcutPreference.findOne({ userId });

        // If no preference record exists, create a default "enabled" record
        if (!preference) {
            preference = await UserShortcutPreference.create({ userId, isEnabled: true });
        }

        res.status(200).json({
            success: true,
            data: {
                isEnabled: preference.isEnabled
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Update user's shortcut enable/disable preference
 * @route   PATCH /api/shortcuts/preference
 * @access  Private
 */
const updateUserPreference = async (req, res) => {
    try {
        const { isEnabled } = req.body;
        const userId = req.user._id;

        if (typeof isEnabled !== 'boolean') {
            return res.status(400).json({ success: false, message: 'isEnabled must be a boolean' });
        }

        const preference = await UserShortcutPreference.findOneAndUpdate(
            { userId },
            { isEnabled },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            message: `Shortcuts ${isEnabled ? 'enabled' : 'disabled'} successfully`,
            data: {
                isEnabled: preference.isEnabled
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    getShortcutDefinitions,
    getUserPreference,
    updateUserPreference
};
