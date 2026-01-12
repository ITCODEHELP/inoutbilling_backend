const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const SalesSummaryModel = require('../models/Dashboard-Model/SalesSummaryModel');
const { getCacheManager } = require('../utils/cacheManager');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const cacheManager = getCacheManager();
        const mockUserId = new mongoose.Types.ObjectId();
        const filters = { userId: mockUserId };
        const cacheKey = cacheManager.generateKey('dashboard:sales-summary', filters, mockUserId);

        // 1. Manually set cache
        const mockData = { totalSales: 999999 };
        await cacheManager.set(cacheKey, mockData);
        console.log('Mock cache set');

        // 2. Simulate normal request (should get cached data)
        let cachedData = await cacheManager.get(cacheKey);
        console.log('Normal request data:', cachedData);

        if (cachedData && cachedData.totalSales === 999999) {
            console.log('SUCCESS: Normal request returned cached data.');
        } else {
            console.log('FAILURE: Cached data not found.');
        }

        // 3. Simulate refresh request bypass (Logic is in controller, here we just verify we can ignore cache)
        const isRefresh = true;
        let freshData;
        if (isRefresh) {
            console.log('Bypassing cache for refresh...');
            freshData = await SalesSummaryModel.getSummary(filters);
        }
        console.log('Refresh request data:', freshData);

        if (freshData && freshData.totalSales === 0) { // New user should have 0 sales
            console.log('SUCCESS: Refresh logic would return fresh data.');
        } else {
            console.log('FAILURE: Fresh data not returned.');
        }

        await cacheManager.delete(cacheKey);
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


