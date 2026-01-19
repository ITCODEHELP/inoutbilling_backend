// 🔴 MUST BE FIRST LINE
require('dotenv').config({ silent: true });

const express = require('express');
const cors = require('cors');
const path = require('path');

const connectDB = require('./config/db');
const { getInitializer } = require('./utils/initializeOptimizedEnvironment');
const { getPerformanceMonitor, performanceMiddleware } = require('./utils/performanceMonitor');

// Routes
const authRoutes = require('./routes/Login-Routes/authRoutes');
const userRoutes = require('./routes/User-Routes/userRoutes');
const customerRoutes = require('./routes/Customer-Vendor-Routes/customerRoutes');
const productRoutes = require('./routes/Product-Service-Routes/productRoutes');
const productGroupRoutes = require('./routes/Product-Service-Routes/productGroupRoutes');
const barcodeCustomizationRoutes = require('./routes/Product-Service-Routes/barcodeCustomizationRoutes');
const importRoutes = require('./routes/Import-Routes/importRoutes');
const deliveryChallanRoutes = require('./routes/Other-Document-Routes/deliveryChallanRoutes');
const barcodeGenerateRoutes = require('./routes/Product-Service-Routes/barcodeGenerateRoutes');
const saleInvoiceRoutes = require('./routes/Sales-Invoice-Routes/saleInvoiceRoutes');
const vendorRoutes = require('./routes/Customer-Vendor-Routes/vendorRoutes');
const customerVendorRoutes = require('./routes/Customer-Vendor-Routes/customerVendorRoutes');
const purchaseInvoiceRoutes = require('./routes/Purchase-Invoice-Routes/purchaseInvoiceRoutes');
const additionalChargeRoutes = require('./routes/Additional-Charge-Routes/additionalChargeRoutes');
const purchaseInvoiceCustomFieldRoutes = require('./routes/Purchase-Invoice-Routes/purchaseInvoiceCustomFieldRoutes');
const productCustomColumnRoutes = require('./routes/Product-Service-Routes/productCustomColumnRoutes');
const membershipRoutes = require('./routes/Setting-Page-Routes/membershipRoutes');
const creditRoutes = require('./routes/Setting-Page-Routes/creditRoutes');
const settingSecurityRoutes = require('./routes/Setting-Page-Routes/settingSecurityRoutes');
const staffRoutes = require('./routes/Setting-Page-Routes/staffRoutes');
const goDriveRoutes = require('./routes/Other-Document-Routes/goDriveRoutes');
const digitalSignatureRoutes = require('./routes/Setting-Page-Routes/digitalSignatureRoutes');
const activityLogRoutes = require('./routes/Activity-Log-Routes/activityLogRoutes');
const generalSettingsRoutes = require('./routes/Setting-Page-Routes/generalSettingsRoutes');
const productStockSettingsRoutes = require('./routes/Product-Service-Routes/productStockSettingsRoutes');
const printTemplateSettingsRoutes = require('./routes/Setting-Page-Routes/printTemplateSettingsRoutes');
const printOptionsRoutes = require('./routes/Setting-Page-Routes/printOptionsRoutes');
const bankDetailsRoutes = require('./routes/Bank-Detail-Routes/bankDetailsRoutes');
const termsConditionsRoutes = require('./routes/Setting-Page-Routes/termsConditionsRoutes');
const shippingEnvelopeSettingsRoutes = require('./routes/Setting-Page-Routes/shippingEnvelopeSettingsRoutes');
const messageTemplateSettingsRoutes = require('./routes/Setting-Page-Routes/messageTemplateSettingsRoutes');
const paymentReminderSettingsRoutes = require('./routes/Setting-Page-Routes/paymentReminderSettingsRoutes');
const customHeaderDesignRoutes = require('./routes/Setting-Page-Routes/customHeaderDesignRoutes');
const headerShapesRoutes = require('./routes/Setting-Page-Routes/headerShapesRoutes');
const inwardPaymentRoutes = require('./routes/Payment-Routes/inwardPaymentRoutes');
const outwardPaymentRoutes = require('./routes/Payment-Routes/outwardPaymentRoutes');
const dailyExpenseRoutes = require('./routes/Expenses-Income-Routes/dailyExpenseRoutes');
const expenseCategoryRoutes = require('./routes/Expenses-Income-Routes/expenseCategoryRoutes');
const otherIncomeRoutes = require('./routes/Expenses-Income-Routes/otherIncomeRoutes');
const otherIncomeCategoryRoutes = require('./routes/Expenses-Income-Routes/otherIncomeCategoryRoutes');
const quotationRoutes = require('./routes/Other-Document-Routes/quotationRoutes');
const proformaRoutes = require('./routes/Other-Document-Routes/proformaRoutes');
const purchaseOrderRoutes = require('./routes/Purchase-Invoice-Routes/purchaseOrderRoutes');
const saleOrderRoutes = require('./routes/Other-Document-Routes/saleOrderRoutes');
const jobWorkRoutes = require('./routes/Other-Document-Routes/jobWorkRoutes');
const letterRoutes = require('./routes/Other-Document-Routes/letterRoutes');
const packingListRoutes = require('./routes/Other-Document-Routes/packingListRoutes');
const manufactureRoutes = require('./routes/Other-Document-Routes/manufactureRoutes');
const creditNoteRoutes = require('./routes/Other-Document-Routes/creditNoteRoutes');
const debitNoteRoutes = require('./routes/Other-Document-Routes/debitNoteRoutes');
const exportInvoiceRoutes = require('./routes/Other-Document-Routes/Multi-CurrencyExportInvoiceRoutes');
const reportRoutes = require('./routes/Report-Routes/salesReportRoutes');
const salesOutstandingReportRoutes = require('./routes/Report-Routes/SalesOutstandingReportRoutes');
const salesProductReportRoutes = require('./routes/Report-Routes/SalesProductReportRoutes');
const inwardPaymentReportRoutes = require('./routes/Report-Routes/InwardPaymentReportRoutes');
const purchaseReportRoutes = require('./routes/Report-Routes/PurchaseReportRoutes');
const purchaseOutstandingReportRoutes = require('./routes/Report-Routes/PurchaseOutstandingReportRoutes');
const purchaseProductReportRoutes = require('./routes/Report-Routes/PurchaseProductReportRoutes');
const outwardPaymentReportRoutes = require('./routes/Report-Routes/OutwardPaymentReportRoutes');
const otherDocumentReportRoutes = require('./routes/Report-Routes/OtherDocumentReportRoutes');
const otherDocumentProductReportRoutes = require('./routes/Report-Routes/OtherDocumentProductReportRoutes');
const companyLedgerReportRoutes = require('./routes/Report-Routes/CompanyLedgerReportRoutes');
const companyOutstandingReportRoutes = require('./routes/Report-Routes/CompanyOutstandingReportRoutes');
const profitLossReportRoutes = require('./routes/Report-Routes/Profit-LossReportRoutes');
const stockReportRoutes = require('./routes/Report-Routes/StockReportRoutes');
const productReportRoutes = require('./routes/Report-Routes/ProductReportRoutes'); // New Route
const dailyExpensesReportRoutes = require('./routes/Report-Routes/DailyExpensesReportRoutes');
const otherIncomeReportRoutes = require('./routes/Report-Routes/OtherIncomeReportRoutes');
const dayBookReportRoutes = require('./routes/Report-Routes/DayBookReportRoutes');
const gstr1ReportRoutes = require('./routes/Report-Routes/GSTR1ReportRoutes');
const gstr2bReportRoutes = require('./routes/Report-Routes/GSTR2BReportRoutes');
const dashboardRoutes = require('./routes/Dashboard-Routes/DashboardRoutes');
const referralRoutes = require('./routes/Setting-Page-Routes/ReferralRoutes');
const whatsappRoutes = require('./routes/Setting-Page-Routes/whatsappRoutes');
const supportEmailRoutes = require('./routes/Setting-Page-Routes/supportEmailRoutes');
const supportPinRoutes = require('./routes/Setting-Page-Routes/supportPinRoutes');
const shortcutKeyRoutes = require('./routes/Setting-Page-Routes/shortcutKeyRoutes');
const financialYearRoutes = require('./routes/Setting-Page-Routes/financialYearRoutes');
const hsnCodeRoutes = require('./routes/Product-Service-Routes/hsnCodeRoutes');

/* -------------------- ROUTES -------------------- */
// ... (existing routes)

const app = express();
const PORT = process.env.PORT || 5000;

/* -------------------- MIDDLEWARE -------------------- */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* -------------------- ROUTES -------------------- */
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/product-group', productGroupRoutes);
app.use('/api/barcode', barcodeCustomizationRoutes);
app.use('/api/import', importRoutes);
app.use('/api/delivery-challans', deliveryChallanRoutes);
app.use('/api/barcode-generate', barcodeGenerateRoutes);
app.use('/api/sale-invoice', saleInvoiceRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/customer-vendor', customerVendorRoutes);
app.use('/api/purchase-invoice', purchaseInvoiceRoutes);
app.use('/api/additional-charges', additionalChargeRoutes);
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
app.use('/api/daily-expenses', dailyExpenseRoutes);
app.use('/api/expense-categories', expenseCategoryRoutes);
app.use('/api/other-incomes', otherIncomeRoutes);
app.use('/api/other-income-categories', otherIncomeCategoryRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/proformas', proformaRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/sale-orders', saleOrderRoutes);
app.use('/api/job-work', jobWorkRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/packing-list', packingListRoutes);
app.use('/api/manufacture', manufactureRoutes);
app.use('/api/credit-note', creditNoteRoutes);
app.use('/api/debit-note', debitNoteRoutes);
app.use('/api/export-invoice', exportInvoiceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/reports', salesOutstandingReportRoutes);
app.use('/api/reports', salesProductReportRoutes);
app.use('/api/reports', inwardPaymentReportRoutes);
app.use('/api/reports', purchaseReportRoutes);
app.use('/api/reports', purchaseOutstandingReportRoutes);
app.use('/api/reports', purchaseProductReportRoutes);
app.use('/api/reports', outwardPaymentReportRoutes);
app.use('/api/reports', otherDocumentReportRoutes);
app.use('/api/reports', otherDocumentProductReportRoutes);
app.use('/api/reports', companyLedgerReportRoutes);
app.use('/api/reports', companyOutstandingReportRoutes);
app.use('/api/reports', profitLossReportRoutes);
app.use('/api/reports', stockReportRoutes);
app.use('/api/reports', productReportRoutes); // New Route
app.use('/api/reports', dailyExpensesReportRoutes);
app.use('/api/reports', otherIncomeReportRoutes);
app.use('/api/reports', dayBookReportRoutes);
app.use('/api/reports', gstr1ReportRoutes);
app.use('/api/reports', gstr2bReportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/referral', referralRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/support-email', supportEmailRoutes);
app.use('/api/support-pin', supportPinRoutes);
app.use('/api/shortcuts', shortcutKeyRoutes);
app.use('/api/financial-year', financialYearRoutes);
app.use('/api/hsn-codes', hsnCodeRoutes);

/* -------------------- PERFORMANCE -------------------- */
const monitor = getPerformanceMonitor();
app.use(performanceMiddleware(monitor));

/* -------------------- BASE -------------------- */
app.get('/', (req, res) => {
    res.send('Inout Billing API is running...');
});

/* -------------------- ERROR HANDLER -------------------- */
app.use((err, req, res, next) => {
    const status = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(status).json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack
    });
});

/* -------------------- SERVER START -------------------- */
async function startServer() {
    try {
        // ✅ DB CONNECTION FIRST
        await connectDB();

        // ✅ OPTIMIZED ENV INITIALIZATION (SILENT)
        const initializer = getInitializer();
        const initResult = await initializer.initialize();

        if (!initResult.success) {
            console.error('❌ Optimized init failed:', initResult.message);
            process.exit(1);
        }

        const server = app.listen(PORT, () => {
            console.log(`🌐 Server running on http://localhost:${PORT}`);
        });

        const shutdown = async () => {
            server.close(async () => {
                await initializer.shutdown();
                process.exit(0);
            });
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

    } catch (error) {
        console.error('❌ Server startup failed:', error.message);
        process.exit(1);
    }
}

startServer();
