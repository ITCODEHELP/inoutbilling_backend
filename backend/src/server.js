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
const purchaseInvoiceRoutes = require('./routes/purchaseInvoiceRoutes');
const additionalChargeRoutes = require('./routes/additionalChargeRoutes');
const purchaseInvoiceCustomFieldRoutes = require('./routes/purchaseInvoiceCustomFieldRoutes');
const productCustomColumnRoutes = require('./routes/productCustomColumnRoutes');
const membershipRoutes = require('./routes/membershipRoutes');
const creditRoutes = require('./routes/creditRoutes');
const settingSecurityRoutes = require('./routes/settingSecurityRoutes');
const staffRoutes = require('./routes/staffRoutes');
const goDriveRoutes = require('./routes/goDriveRoutes');
const digitalSignatureRoutes = require('./routes/digitalSignatureRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const generalSettingsRoutes = require('./routes/generalSettingsRoutes');
const productStockSettingsRoutes = require('./routes/productStockSettingsRoutes');
const printTemplateSettingsRoutes = require('./routes/printTemplateSettingsRoutes');
const printOptionsRoutes = require('./routes/printOptionsRoutes');
const bankDetailsRoutes = require('./routes/bankDetailsRoutes');
const termsConditionsRoutes = require('./routes/termsConditionsRoutes');
const shippingEnvelopeSettingsRoutes = require('./routes/shippingEnvelopeSettingsRoutes');
const messageTemplateSettingsRoutes = require('./routes/messageTemplateSettingsRoutes');
const paymentReminderSettingsRoutes = require('./routes/paymentReminderSettingsRoutes');
const customHeaderDesignRoutes = require('./routes/customHeaderDesignRoutes');
const headerShapesRoutes = require('./routes/headerShapesRoutes');
const inwardPaymentRoutes = require('./routes/inwardPaymentRoutes');
const outwardPaymentRoutes = require('./routes/outwardPaymentRoutes');




// Load env vars
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(require('path').join(__dirname, 'uploads')));

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
app.use('/api/purchase-invoice/custom-fields', purchaseInvoiceCustomFieldRoutes);
app.use('/api/product/custom-columns', productCustomColumnRoutes);
app.use('/api/setting-membership', membershipRoutes);
app.use('/api/setting-credit', creditRoutes);
app.use('/api/setting-security', settingSecurityRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/go-drive', goDriveRoutes);
app.use('/api/setting-digital-signature', digitalSignatureRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/general-settings', generalSettingsRoutes);
app.use('/api/product-stock-settings', productStockSettingsRoutes);
app.use('/api/print-template-settings', printTemplateSettingsRoutes);
app.use('/api/print-options', printOptionsRoutes);
app.use('/api/bank-details', bankDetailsRoutes);
app.use('/api/terms-conditions', termsConditionsRoutes);
app.use('/api/shipping-envelope-settings', shippingEnvelopeSettingsRoutes);
app.use('/api/message-templates', messageTemplateSettingsRoutes);
app.use('/api/payment-reminder-settings', paymentReminderSettingsRoutes);
app.use('/api/custom-header-design', customHeaderDesignRoutes);
app.use('/api/header-shapes', headerShapesRoutes);
app.use('/api/inward-payments', inwardPaymentRoutes);
app.use('/api/outward-payments', outwardPaymentRoutes);

app.use('/api/purchase-invoice', purchaseInvoiceRoutes);
app.use('/api/additional-charges', additionalChargeRoutes);




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
