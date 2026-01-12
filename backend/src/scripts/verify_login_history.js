const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const { recordLogin } = require('../src/utils/securityHelper');
const LoginHistory = require('../src/models/Login-Model/LoginHistory');
const LoginActivityModel = require('../src/models/Dashboard-Model/LoginActivityModel');
const connectDB = require('../src/config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        // Mock data
        const mockUserId = new mongoose.Types.ObjectId();
        const mockUser = {
            _id: mockUserId,
            trackLoginLocation: true
        };
        const mockReq = {
            headers: { 'user-agent': 'Mozilla/5.0' },
            ip: '127.0.0.1'
        };

        console.log('Recording login for mock user:', mockUserId);
        // Correct parameter order: req, user
        await recordLogin(mockReq, mockUser);

        console.log('Fetching activity for mock user...');
        const activity = await LoginActivityModel.getActivity({
            userId: mockUserId
        });

        console.log('Activity result count:', activity.length);
        if (activity.length > 0) {
            console.log('First record loginTime:', activity[0].loginTime);
        }

        if (activity.length > 0 && activity[0].userId.toString() === mockUserId.toString()) {
            console.log('SUCCESS: Login history retrieved correctly (List format, Descending).');
        } else {
            console.log('FAILURE: Login history not retrieved correctly.');
        }

        // Cleanup
        await LoginHistory.deleteMany({ userId: mockUserId });
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


