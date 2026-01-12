const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const InvoiceSummaryModel = require('../models/Dashboard-Model/InvoiceSummaryModel');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const mockUserId = new mongoose.Types.ObjectId();
        const filters = { userId: mockUserId };

        console.log('Testing Count Summary API for user:', mockUserId);
        const counts = await InvoiceSummaryModel.getCountSummary(filters);
        console.log('Counts:', JSON.stringify(counts, null, 2));

        console.log('Testing Amount Summary API for user:', mockUserId);
        const amounts = await InvoiceSummaryModel.getAmountSummary(filters);
        console.log('Amounts:', JSON.stringify(amounts, null, 2));

        if (counts && amounts && 'saleCount' in counts && 'totalSales' in amounts) {
            console.log('SUCCESS: Invoice Summary APIs returned the expected structure.');
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


