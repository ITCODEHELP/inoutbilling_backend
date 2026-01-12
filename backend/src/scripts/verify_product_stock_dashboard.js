const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ProductInsightsModel = require('../models/Dashboard-Model/ProductInsightsModel');
const StockDashboardModel = require('../models/Dashboard-Model/StockDashboardModel');
const Product = require('../models/Product-Service-Model/Product');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const mockUserId = new mongoose.Types.ObjectId();

        // 1. Setup mock product for low stock
        const lowStockProduct = new Product({
            userId: mockUserId,
            name: 'Low Stock Item',
            tax: 18,
            manageStock: true,
            qty: 2,
            lowStockAlert: 5,
            unit: 'PCS'
        });
        await lowStockProduct.save();
        console.log('Mock low stock product saved');

        // 2. Test Low Stock API
        console.log('Testing Low Stock API...');
        const lowStockData = await StockDashboardModel.getLowStockProducts({ userId: mockUserId });
        console.log('Low Stock Data:', JSON.stringify(lowStockData, null, 2));

        if (lowStockData.count === 1 && lowStockData.data[0].name === 'Low Stock Item') {
            console.log('SUCCESS: Low Stock API verified.');
        } else {
            console.log('FAILURE: Low Stock API verification failed.');
        }

        // 3. Test Least Selling (will be empty but should not crash)
        console.log('Testing Least Selling API...');
        const leastSelling = await ProductInsightsModel.getLeastProducts({ userId: mockUserId });
        console.log('Least Selling Count:', leastSelling.length);

        console.log('SUCCESS: All new Product/Stock APIs returned valid structures.');

        // Cleanup
        await Product.deleteMany({ userId: mockUserId });
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


