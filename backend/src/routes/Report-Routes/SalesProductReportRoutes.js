const express = require('express');
const router = express.Router();
const SalesProductReportController = require('../../controllers/Report-Controller/SalesProductReportController');
const { protect } = require('../../middlewares/authMiddleware');

/**
 * @swagger
 * /api/reports/sales-product:
 *   post:
 *     summary: Search Sales Product Report
 *     description: Fetch sales product report data with advanced filtering and grouping options
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerVendor:
 *                 type: string
 *                 description: Filter by customer/vendor name
 *               products:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Filter by specific products
 *               productGroup:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Filter by product groups
 *               staffName:
 *                 type: string
 *                 description: Filter by staff name
 *               invoiceNumber:
 *                 type: string
 *                 description: Filter by invoice number
 *               invoiceSeries:
 *                 type: string
 *                 description: Filter by invoice series/prefix
 *               groupProductBy:
 *                 type: string
 *                 enum: ["Title with GST%", "HSN", "HSN with GST%", "Title with HSN with GST%"]
 *                 description: Group products by selected criteria
 *               fromDate:
 *                 type: string
 *                 format: date
 *                 description: Start date for date range filter
 *               toDate:
 *                 type: string
 *                 format: date
 *                 description: End date for date range filter
 *               showPrimaryUOM:
 *                 type: boolean
 *                 description: Include primary UOM in results
 *               advanceFilters:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     field:
 *                       type: string
 *                       description: Field to filter on
 *                     operator:
 *                       type: string
 *                       enum: ["equals", "notEquals", "greaterThan", "lessThan", "greaterThanOrEqual", "lessThanOrEqual", "contains"]
 *                       description: Filter operator
 *                     value:
 *                       type: string
 *                       description: Filter value
 *               limit:
 *                 type: number
 *                 description: Limit number of results
 *     responses:
 *       200:
 *         description: Sales product report data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName:
 *                         type: string
 *                       hsnSac:
 *                         type: string
 *                       gstPercentage:
 *                         type: number
 *                       totalQuantity:
 *                         type: number
 *                       totalAmount:
 *                         type: number
 *                       totalTax:
 *                         type: number
 *                       avgPrice:
 *                         type: number
 *                       invoiceCount:
 *                         type: number
 *                       primaryUOM:
 *                         type: string
 *                 count:
 *                   type: number
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.post('/sales-product', protect, SalesProductReportController.searchSalesProductReport);

/**
 * @swagger
 * /api/reports/sales-product:
 *   get:
 *     summary: Get Sales Product Report Data
 *     description: Fetch sales product report data using query parameters
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: customerVendor
 *         schema:
 *           type: string
 *         description: Filter by customer/vendor name
 *       - in: query
 *         name: groupProductBy
 *         schema:
 *           type: string
 *           enum: ["Title with GST%", "HSN", "HSN with GST%", "Title with HSN with GST%"]
 *         description: Group products by selected criteria
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for date range filter
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for date range filter
 *       - in: query
 *         name: showPrimaryUOM
 *         schema:
 *           type: boolean
 *         description: Include primary UOM in results
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: Sales product report data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productName:
 *                         type: string
 *                       hsnSac:
 *                         type: string
 *                       gstPercentage:
 *                         type: number
 *                       totalQuantity:
 *                         type: number
 *                       totalAmount:
 *                         type: number
 *                       totalTax:
 *                         type: number
 *                       avgPrice:
 *                         type: number
 *                       invoiceCount:
 *                         type: number
 *                       primaryUOM:
 *                         type: string
 *                 count:
 *                   type: number
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/sales-product', protect, SalesProductReportController.searchSalesProductReport);

/**
 * @swagger
 * /api/reports/sales-product/metadata:
 *   get:
 *     summary: Get Sales Product Report Filter Metadata
 *     description: Get available filter options, grouping options, and field metadata for sales product report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Filter metadata retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     groupingOptions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     operators:
 *                       type: array
 *                       items:
 *                         type: string
 *                     availableFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Internal server error
 */
router.get('/sales-product/metadata', protect, SalesProductReportController.getFilterMetadata);

module.exports = router;
