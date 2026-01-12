const express = require('express');
const router = express.Router();
const { protect } = require('../../middlewares/authMiddleware');

const SalesSummaryController = require('../../controllers/Dashboard-Controller/SalesSummaryController');
const PurchaseSummaryController = require('../../controllers/Dashboard-Controller/PurchaseSummaryController');
const ExpenseIncomeController = require('../../controllers/Dashboard-Controller/ExpenseIncomeController');
const OutstandingController = require('../../controllers/Dashboard-Controller/OutstandingController');
const SalesMapController = require('../../controllers/Dashboard-Controller/SalesMapController');
const CustomerTrendController = require('../../controllers/Dashboard-Controller/CustomerTrendController');
const PaymentSummaryController = require('../../controllers/Dashboard-Controller/PaymentSummaryController');
const InventorySummaryController = require('../../controllers/Dashboard-Controller/InventorySummaryController');
const InvoiceTrendsController = require('../../controllers/Dashboard-Controller/InvoiceTrendsController');
const ProductInsightsController = require('../../controllers/Dashboard-Controller/ProductInsightsController');
const PartyInsightsController = require('../../controllers/Dashboard-Controller/PartyInsightsController');
const DueInvoicesController = require('../../controllers/Dashboard-Controller/DueInvoicesController');
const LoginActivityController = require('../../controllers/Dashboard-Controller/LoginActivityController');

const StockDashboardController = require('../../controllers/Dashboard-Controller/StockDashboardController');

const InvoiceSummaryRoutes = require('./InvoiceSummaryRoutes');
const PaymentSummaryRoutes = require('./PaymentSummaryRoutes');

// All routes are protected by auth middleware
router.use(protect);

router.use('/invoice-summary', InvoiceSummaryRoutes);
router.use('/payment-summary', PaymentSummaryRoutes);

// Insights
router.get('/best-selling', ProductInsightsController.getTopProducts);
router.get('/least-selling', ProductInsightsController.getLeastProducts);
router.get('/low-stock', StockDashboardController.getLowStock);

router.get('/sales-summary', SalesSummaryController.getSalesSummary);
router.get('/purchase-summary', PurchaseSummaryController.getPurchaseSummary);
router.get('/expense-income', ExpenseIncomeController.getExpenseIncome);
router.get('/outstanding', OutstandingController.getOutstanding);
router.get('/aging', OutstandingController.getAging);
router.get('/sales-map', SalesMapController.getSalesMap);
router.get('/customer-trend', CustomerTrendController.getTrends);
router.get('/inventory', InventorySummaryController.getInventorySummary);
router.get('/invoice-trends', InvoiceTrendsController.getTrends);
router.get('/top-products', ProductInsightsController.getTopProducts);
router.get('/top-parties', PartyInsightsController.getTopParties);
router.get('/due-invoices', DueInvoicesController.getDueInvoices);
router.get('/login-activity', LoginActivityController.getActivity);

module.exports = router;
