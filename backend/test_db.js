require('dotenv').config();
const mongoose = require('mongoose');
const SaleOrder = require('./src/models/Other-Document-Model/SaleOrder');

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('Connected to MongoDB');
    console.log('SO Count:', await SaleOrder.countDocuments());
    const so = await SaleOrder.findOne().lean();
    console.log('Sample SO:', so ? so._id : 'None');
    process.exit(0);
}).catch(e => {
    console.error('Error connecting to DB:', e);
    process.exit(1);
});
