const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PaymentSummaryModel = require('../models/Dashboard-Model/PaymentSummaryModel');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const mockUserId = new mongoose.Types.ObjectId();
        const filters = { userId: mockUserId };

        console.log('Testing Payment Summary API for user:', mockUserId);
        const data = await PaymentSummaryModel.getPaymentSummary(filters);
        console.log('Payment Summary:', JSON.stringify(data, null, 2));

        if (data && 'totalInwardPayment' in data && 'totalOutwardPayment' in data) {
            console.log('SUCCESS: Payment Summary API returned the expected structure.');
        } else {
            console.log('FAILURE: Response structure mismatch.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


