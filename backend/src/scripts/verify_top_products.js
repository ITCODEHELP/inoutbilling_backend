const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ProductInsightsModel = require('../models/Dashboard-Model/ProductInsightsModel');
const SaleInvoice = require('../models/Sales-Invoice-Model/SaleInvoice');
const connectDB = require('../config/db');

async function verify() {
    try {
        await connectDB();
        console.log('Connected to DB');

        const mockUserId = new mongoose.Types.ObjectId();

        // Insert a mock invoice
        const mockInvoice = new SaleInvoice({
            userId: mockUserId,
            customerInformation: {
                ms: 'Test Customer',
                placeOfSupply: 'Maharashtra'
            },
            invoiceDetails: {
                invoiceNumber: 'INV-' + Date.now(),
                date: new Date()
            },
            items: [
                {
                    productName: 'Product A',
                    qty: 2,
                    price: 100, // Expected value: 2 * 100 = 200
                    total: 100 // Deliberate mismatch to verify multiply logic
                },
                {
                    productName: 'Product B',
                    qty: 5,
                    price: 50, // Expected value: 5 * 50 = 250
                    total: 10 // Deliberate mismatch
                }
            ],
            paymentType: 'CASH'
        });

        await mockInvoice.save();
        console.log('Mock invoice saved');

        const topProducts = await ProductInsightsModel.getTopProducts({
            userId: mockUserId
        });

        console.log('Top Products result:', JSON.stringify(topProducts, null, 2));

        const productA = topProducts.find(p => p.name === 'Product A');
        const productB = topProducts.find(p => p.name === 'Product B');

        if (productA && productA.totalValue === 200 && productB && productB.totalValue === 250) {
            console.log('SUCCESS: Total value calculated correctly using multiply.');
        } else {
            console.log('FAILURE: Total value mismatch.');
        }

        // Cleanup
        await SaleInvoice.deleteMany({ userId: mockUserId });
        process.exit(0);
    } catch (error) {
        console.error('Verification error:', error);
        process.exit(1);
    }
}

verify();


