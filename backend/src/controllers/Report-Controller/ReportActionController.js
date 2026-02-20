const ReportActionHelper = require('../../utils/reportExportHelper');

// Import ALL Report Models
const SalesReportModel = require('../../models/Report-Model/salesReportModel');
const SalesOutstandingReportModel = require('../../models/Report-Model/SalesOutstandingReportModel');
const SalesProductReportModel = require('../../models/Report-Model/SalesProductReportModel');
const InwardPaymentReportModel = require('../../models/Report-Model/InwardPaymentReportModel');

const PurchaseReportModel = require('../../models/Report-Model/PurchaseReportModel');
const PurchaseOutstandingReportModel = require('../../models/Report-Model/PurchaseOutstandingReportModel');
const PurchaseProductReportModel = require('../../models/Report-Model/PurchaseProductReportModel');
const OutwardPaymentReportModel = require('../../models/Report-Model/OutwardPaymentReportModel');

const OtherDocumentReportModel = require('../../models/Report-Model/OtherDocumentReportModel');
const OtherDocumentProductReportModel = require('../../models/Report-Model/OtherDocumentProductReportModel');
const CompanyLedgerReportModel = require('../../models/Report-Model/CompanyLedgerReportModel');
const CompanyOutstandingReportModel = require('../../models/Report-Model/CompanyOutstandingReportModel');
const ProfitLossReportModel = require('../../models/Report-Model/Profit-LossReportModel');
const StockReportModel = require('../../models/Report-Model/StockReportModel');
const ProductReportModel = require('../../models/Report-Model/ProductReportModel');
const DailyExpensesReportModel = require('../../models/Report-Model/DailyExpensesReportModel');
const OtherIncomeReportModel = require('../../models/Report-Model/OtherIncomeReportModel');

/**
 * STRATEGY MAP
 */
const REPORT_STRATEGIES = {
    // Sales
    'sales': { model: SalesReportModel, method: 'getSalesReport' },
    'sales-outstanding': { model: SalesOutstandingReportModel, method: 'getSalesOutstandingReport' },
    'sales-product': { model: SalesProductReportModel, method: 'getSalesProductReport' },
    'inward-payment': { model: InwardPaymentReportModel, method: 'getInwardPaymentReport' },

    // Purchase
    'purchase': { model: PurchaseReportModel, method: 'getPurchaseReport' },
    'purchase-outstanding': { model: PurchaseOutstandingReportModel, method: 'getPurchaseOutstandingReport' },
    'purchase-product': { model: PurchaseProductReportModel, method: 'getPurchaseProductReport' },
    'outward-payment': { model: OutwardPaymentReportModel, method: 'getOutwardPaymentReport' },

    // Other
    'other-document': { model: OtherDocumentReportModel, method: 'getOtherDocumentReport' },
    'other-document-product': { model: OtherDocumentProductReportModel, method: 'getOtherDocumentProductReport' },
    'company-ledger': { model: CompanyLedgerReportModel, method: 'getCompanyLedgerReport' },
    'company-outstanding': { model: CompanyOutstandingReportModel, method: 'getCompanyOutstandingReport' },
    'profit-loss': { model: ProfitLossReportModel, method: 'getProfitLossReport' },
    'stock': { model: StockReportModel, method: 'getStockReport' },
    'product': { model: ProductReportModel, method: 'getProductReport' },
    'daily-expenses': { model: DailyExpensesReportModel, method: 'getDailyExpensesReport' },
    'other-income': { model: OtherIncomeReportModel, method: 'getOtherIncomeReport' },
};

class ReportActionController {

    // Helper: Flatten Object to get Dot-Notation Keys
    static getLeafPaths(obj, prefix = '') {
        return Object.keys(obj).reduce((acc, key) => {
            const val = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
                return acc.concat(ReportActionController.getLeafPaths(val, newKey));
            } else {
                return acc.concat(newKey);
            }
        }, []);
    }

    // Helper: Detect Columns from Data
    static getColumnsFromData(data) {
        if (!data || data.length === 0) return [];

        const firstRecord = data[0];
        // Flatten to get all possible fields
        const keys = ReportActionController.getLeafPaths(firstRecord);

        // Filter out technical fields and unnecessary large objects
        const filteredKeys = keys.filter(k =>
            !k.startsWith('_') &&
            !k.includes('password') &&
            !k.includes('__v') &&
            !k.includes('items') // Exclude array items if flattened
        );

        // Create Column Definitions
        return filteredKeys.map(key => ({
            field: key,
            label: ReportActionHelper.formatHeader(key),
            type: key.toLowerCase().includes('date') ? 'date' :
                (typeof ReportActionHelper.getValue(firstRecord, key) === 'number' ? 'number' : 'string')
        }));
    }

    static async getReportData(reportType, filters, options, user) {
        const strategy = REPORT_STRATEGIES[reportType];
        if (!strategy) {
            throw new Error(`Invalid report type: ${reportType}`);
        }

        filters.userId = user._id;
        const exportOptions = { ...options, page: 1, limit: 1000000 };
        // Execute Model Method
        const result = await strategy.model[strategy.method](filters, exportOptions);

        if (!result.success) {
            throw new Error(result.message || 'Failed to fetch report data');
        }

        // Return standardized object
        // The Model returns { data: { docs: [], totalDocs: ... } } OR { data: { columns, data, pagination } }

        let records = [];
        let summary = {};
        let pagination = {};
        let columns = []; // New

        if (result.data.data && Array.isArray(result.data.data)) {
            // New Sales Report Structure
            const allData = result.data.data;
            const paginationData = result.data.pagination || {};

            // Capture columns if provided
            columns = result.data.columns || [];

            // Extract total row for summary
            if (allData.length > 0) {
                const lastItem = allData[allData.length - 1];
                if (lastItem.isTotalRow) {
                    summary = {
                        taxableValueTotal: lastItem.taxableValueTotal || 0,
                        grandTotal: lastItem.grandTotal || 0,
                        totalInvoices: paginationData.totalDocs || 0
                    };
                    records = allData.slice(0, -1);
                } else {
                    records = allData;
                }
            } else {
                records = [];
            }

            pagination = {
                totalDocs: paginationData.totalDocs,
                page: paginationData.page
            };
        } else {
            // Standard Structure for other reports
            records = result.data.docs || [];
            summary = result.data.summary || {};
            pagination = {
                totalDocs: result.data.totalDocs,
                page: result.data.page
            };
        }

        return {
            records,
            summary,
            pagination,
            columns // Return columns
        };
    }

    static async handleAction(req, res, actionType) {
        try {
            const { reportType, filters = {}, options = {}, reportTitle = 'Report', email, message } = req.body;

            // 1. Fetch Data
            const { records, summary, columns: fetchedColumns } = await ReportActionController.getReportData(reportType, filters, options, req.user);

            // 2. Determine Columns
            let columnsToUse = req.body.columns;
            if (!columnsToUse || columnsToUse.length === 0) {
                // Priority 1: Use columns returned by Model (e.g. Sales Report)
                if (fetchedColumns && fetchedColumns.length > 0) {
                    // Ensure format is { field, label }
                    columnsToUse = fetchedColumns.map(c =>
                        typeof c === 'string' ? { field: c, label: ReportActionHelper.formatHeader(c) } : c
                    );
                }
                // Priority 2: Fetch default columns from Model Metadata
                else {
                    const strategy = REPORT_STRATEGIES[reportType];
                    if (strategy && strategy.model.getFilterMetadata) {
                        const docType = filters ? filters.documentType : undefined;
                        const metadata = strategy.model.getFilterMetadata(docType);
                        // Handle different metadata structures
                        if (metadata.columns && Array.isArray(metadata.columns)) {
                            // Check if columns are already objects or just strings
                            columnsToUse = metadata.columns.map(col => {
                                if (typeof col === 'object' && col.field) {
                                    return col;
                                }
                                return { field: col, label: col };
                            });
                        } else if (metadata.availableColumns && metadata.availableColumns.invoiceLevel) {
                            // Helper for Sales Report structure if not returned in data
                            columnsToUse = metadata.availableColumns.invoiceLevel;
                        } else {
                            // Fallback to auto-detection
                            columnsToUse = records.length > 0 ? ReportActionController.getColumnsFromData(records) : [];
                        }
                    } else {
                        // Fallback to auto-detection
                        columnsToUse = records.length > 0 ? ReportActionController.getColumnsFromData(records) : [];
                    }
                }
            }

            // 3. Prepare Params
            const commonParams = {
                data: records,
                columns: columnsToUse,
                reportTitle,
                filters,
                companyInfo: req.user,
                summary,
                email,
                message
            };

            // 4. Execute Action
            if (actionType === 'print') {
                const html = ReportActionHelper.generateReportHtml(commonParams);
                res.send(html);
            } else if (actionType === 'pdf') {
                const pdfBuffer = await ReportActionHelper.generateReportPdf(commonParams);
                res.set({
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${reportTitle}.pdf"`,
                    'Content-Length': pdfBuffer.length
                });
                res.send(pdfBuffer);
            } else if (actionType === 'excel') {
                const excelBuffer = await ReportActionHelper.generateReportExcel(commonParams);
                res.set({
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="${reportTitle}.xlsx"`,
                    'Content-Length': excelBuffer.length
                });
                res.send(excelBuffer);
            } else if (actionType === 'email') {
                await ReportActionHelper.sendReportEmail(commonParams);
                res.json({ success: true, message: 'Email sent successfully' });
            }

        } catch (error) {
            console.error(`${actionType} Action Error:`, error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // --- Endpoints ---
    static async printReport(req, res) { await ReportActionController.handleAction(req, res, 'print'); }
    static async downloadPdf(req, res) { await ReportActionController.handleAction(req, res, 'pdf'); }
    static async downloadExcel(req, res) { await ReportActionController.handleAction(req, res, 'excel'); }
    static async emailReport(req, res) { await ReportActionController.handleAction(req, res, 'email'); }
}

module.exports = ReportActionController;
