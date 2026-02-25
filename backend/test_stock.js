require('dotenv').config();
const mongoose = require('mongoose');
const StockReportModel = require('./src/models/Report-Model/StockReportModel');
const Product = require('./src/models/Product-Service-Model/Product');
const SaleInvoice = require('./src/models/Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('./src/models/Purchase-Invoice-Model/PurchaseInvoice');
const User = require('./src/models/User-Model/User');

async function run() {
    await mongoose.connect('mongodb://localhost:27017/inoutbilling');
    console.log('Connected to DB');

    const user = await User.findOne();
    if (!user) {
        console.log('No user found');
        process.exit(1);
    }
    const userId = user._id;

    console.log(`Testing with user: ${userId}`);

    // Check if there are any products
    const products = await Product.find({ userId });
    console.log(`Found ${products.length} products for user.`);

    const sales = await SaleInvoice.countDocuments({ userId });
    const purchases = await PurchaseInvoice.countDocuments({ userId });
    console.log(`Sales: ${sales}, Purchases: ${purchases}`);

    const payload = {
        documentType: "Stock Report",
        productId: "",
        productGroupId: "",
        stockAsOnDate: "2026-02-25",
        minStock: 0,
        maxStock: 10,
        hideZeroStock: true,
        showSellValue: true,
        showPurchaseValue: true,
        page: 1,
        limit: 50,
        sortBy: "name",
        sortOrder: "asc",
        userId: userId
    };

    const result = await StockReportModel.getStockReport(payload, payload);
    console.log('\n--- API Result ---');
    console.log(JSON.stringify(result, null, 2));

    process.exit(0);
}

run().catch(console.error);
