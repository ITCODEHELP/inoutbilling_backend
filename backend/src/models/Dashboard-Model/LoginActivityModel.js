const mongoose = require('mongoose');
const LoginHistory = require('../Login-Model/LoginHistory');

class LoginActivityModel {
    /**
     * Get Login Activity from LoginHistory with strict filtering
     */
    static async getActivity(filters) {
        const { userId, fromDate, toDate } = filters;

        // Build strict match object
        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        // Date filtering only on loginTime using $gte/$lte
        if (fromDate || toDate) {
            match.loginTime = {};
            if (fromDate) match.loginTime.$gte = new Date(fromDate);
            if (toDate) match.loginTime.$lte = new Date(toDate);
        }

        // Return records sorted by loginTime descending
        // Uses .find() for a flat list instead of .aggregate() group
        return await LoginHistory.find(match)
            .sort({ loginTime: -1 })
            .lean();
    }
}

module.exports = LoginActivityModel;
