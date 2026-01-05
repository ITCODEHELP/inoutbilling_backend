const ActivityLog = require('../models/ActivityLog');

// @desc    Fetch activity logs with optional filters
// @route   GET /api/activity-logs
// @access  Private
const getActivityLogs = async (req, res) => {
    try {
        const {
            staffId,
            search,
            action,
            module,
            startDate,
            endDate,
            showAll
        } = req.query;

        // Base query - only logs belonging to this owner
        let query = {
            userId: req.user.ownerRef ? req.user.ownerRef : req.user._id
        };

        // Filter by staffId
        if (staffId) {
            query.staffId = staffId;
        }

        // Filter by action (Insert, Update, Delete)
        if (action) {
            query.action = action;
        }

        // Filter by Module (referenceName)
        if (module) {
            query.module = module;
        }

        // Search text (on description or refNo)
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { refNo: { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filter
        if (showAll !== 'true' && (startDate || endDate)) {
            query.timestamp = {};
            if (startDate) {
                query.timestamp.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.timestamp.$lte = end;
            }
        }

        const logs = await ActivityLog.find(query)
            .populate('staffId', 'fullName userId')
            .sort({ timestamp: -1 });

        res.status(200).json({
            success: true,
            message: 'Activity logs fetched successfully',
            total: logs.length,
            data: logs
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

module.exports = {
    getActivityLogs
};
