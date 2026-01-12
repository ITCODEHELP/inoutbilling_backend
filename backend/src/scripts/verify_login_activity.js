const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { recordLogin } = require('../utils/securityHelper');
const LoginActivity = require('../models/Login-Model/LoginActivity');
const LoginActivityModel = require('../models/Dashboard-Model/LoginActivityModel');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        // Mock data
        const mockUserId = new mongoose.Types.ObjectId();
        const mockReq = {
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
            ip: '127.0.0.1',
            body: { branchId: new mongoose.Types.ObjectId() }
        };

        console.log('Recording login for mock user:', mockUserId);
        await recordLogin(mockUserId, mockReq);

        console.log('Fetching activity for mock user...');
        const activity = await LoginActivityModel.getActivity({
            userId: mockUserId
        });

        console.log('Activity result:', JSON.stringify(activity, null, 2));

        if (activity.length > 0 && activity[0].date && activity[0].loginCount) {
            console.log('SUCCESS: Login activity recorded and retrieved correctly.');
        } else {
            console.log('FAILURE: Login activity not retrieved correctly.');
        }

        // Cleanup mock data
        await LoginActivity.deleteMany({ userId: mockUserId });
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


