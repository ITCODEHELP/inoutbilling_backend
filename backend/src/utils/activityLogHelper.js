const ActivityLog = require('../models/ActivityLog');

/**
 * Centrally records an activity log.
 * @param {Object} req - Express request object (to get user/staff info)
 * @param {String} action - 'Insert', 'Update', or 'Delete'
 * @param {String} module - The name of the module (e.g., 'Product')
 * @param {String} description - Narrative description of the action
 * @param {String} [refNo] - Optional reference number (e.g., Invoice Number)
 */
const recordActivity = async (req, action, module, description, refNo = '') => {
    try {
        const logData = {
            userId: req.user.ownerRef ? req.user.ownerRef : req.user._id, // Support for logged-in staff too
            staffId: req.user.ownerRef ? req.user._id : null,
            action,
            module,
            description,
            refNo,
            timestamp: new Date()
        };

        if (req.user && req.user.userId) {
            // Include username/staffID in description if not provided
            const actor = req.user.fullName || req.user.userId;
            // description = `${actor}: ${description}`;
        }

        await ActivityLog.create(logData);
    } catch (error) {
        console.error('Activity Logging Error:', error.message);
    }
};

module.exports = { recordActivity };
