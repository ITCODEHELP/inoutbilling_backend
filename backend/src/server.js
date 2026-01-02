const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customerRoutes');
const productRoutes = require('./routes/productRoutes');
const productGroupRoutes = require('./routes/productGroupRoutes');
const barcodeCustomizationRoutes = require('./routes/barcodeCustomizationRoutes');
const importRoutes = require('./routes/importRoutes');
const barcodeGenerateRoutes = require('./routes/barcodeGenerateRoutes');
const saleInvoiceRoutes = require('./routes/saleInvoiceRoutes');
const vendorRoutes = require('./routes/vendorRoutes');
const customerVendorRoutes = require('./routes/customerVendorRoutes');

// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-group', productGroupRoutes);
app.use('/api/barcode', barcodeCustomizationRoutes);
app.use('/api/import', importRoutes);
app.use('/api/barcode-generate', barcodeGenerateRoutes);
app.use('/api/sale-invoice', saleInvoiceRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/customer-vendor', customerVendorRoutes);

// Base Route
app.get('/', (req, res) => {
    res.send('Inout Billing API is running...');
});

// Error handling middleware
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
