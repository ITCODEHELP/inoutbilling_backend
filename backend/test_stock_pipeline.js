const mongoose = require('mongoose');
const User = require('./src/models/User-Model/User');
const Product = require('./src/models/Product-Service-Model/Product');
const StockReportModel = require('./src/models/Report-Model/StockReportModel');

async function debugStock() {
    await mongoose.connect('mongodb://localhost:27017/inoutbilling');
    const u = await User.findOne();
    if (!u) {
        console.log('No user found');
        process.exit(1);
    }

    console.log(`User found: ${u._id}`);

    // Test base product query manually
    const products = await Product.aggregate([
        { $match: { userId: u._id, itemType: 'Product' } },
        { $project: { name: 1, availableQuantity: 1, lowStockAlert: 1 } },
        { $limit: 3 }
    ]);
    console.log('\n--- 1. Raw Products ---', products);

    // Test API call manually
    const reqBody = {
        documentType: "Stock Report",
        stockAsOnDate: "2026-02-25",
        hideZeroStock: true,
        showSellValue: true,
        showPurchaseValue: true,
        userId: u._id
    };

    console.log('\n--- 2. Direct API Call Result ---');
    const result = await StockReportModel.getStockReport(reqBody, { limit: 5 });
    console.log(JSON.stringify(result.data.docs, null, 2));

    process.exit(0);
}

debugStock().catch(e => { console.error(e); process.exit(1); });
