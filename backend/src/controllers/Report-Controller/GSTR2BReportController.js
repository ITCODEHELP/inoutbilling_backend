const GSTR2BReportModel = require('../../models/Report-Model/GSTR2BReportModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const excel = require('exceljs');

// Configure Multer for Excel file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.xlsx' || ext === '.xls') {
            cb(null, true);
        } else {
            cb(new Error('Upload valid Excel file. And Sheet Name should be B2B.'));
        }
    }
}).single('gstr2bFile');

class GSTR2BReportController {
    /**
     * Handle GSTR-2B upload and reconciliation
     */
    static async uploadAndReconcile(req, res) {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: 'Upload valid Excel. And Sheet Name should be B2B.' });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Upload valid Excel. And Sheet Name should be B2B.' });
            }

            try {
                const { fromDate, toDate } = req.body;
                const userId = req.user._id;

                // 1. Load Excel Workbook
                const workbook = new excel.Workbook();
                await workbook.xlsx.load(req.file.buffer);

                // 2. Check for exact 'B2B' sheet
                const b2bSheet = workbook.getWorksheet('B2B');
                if (!b2bSheet) {
                    return res.status(400).json({ success: false, message: 'Upload valid Excel. And Sheet Name should be B2B.' });
                }

                const normalizedInvoices = [];
                let headersRowIndex = -1;
                let colMap = {};

                // Find the header row by looking for 'gstin' or 'invoice num'
                b2bSheet.eachRow((row, rowNumber) => {
                    if (headersRowIndex === -1) {
                        const rowValues = row.values.map(v => v ? String(v).toLowerCase().trim() : '');
                        if (rowValues.some(v => v.includes('invoice num') || v.includes('gstin'))) {
                            headersRowIndex = rowNumber;
                            // Map columns
                            row.eachCell((cell, colNumber) => {
                                const val = String(cell.value || '').toLowerCase().trim();
                                if (val.includes('gstin')) colMap.gstin = colNumber;
                                if (val.includes('invoice')) {
                                    if (val.includes('date')) colMap.date = colNumber;
                                    else if (val.includes('num')) colMap.invNo = colNumber;
                                    else if (!colMap.invNo) colMap.invNo = colNumber; // fallback
                                }
                                if (val.includes('date') && !val.includes('invoice')) colMap.date = colNumber;
                                if (val.includes('taxable')) colMap.taxable = colNumber;
                                if (val === 'igst' || val.includes('integrated tax')) colMap.igst = colNumber;
                                if (val === 'cgst' || val.includes('central tax')) colMap.cgst = colNumber;
                                if (val === 'sgst' || val.includes('state/ut tax')) colMap.sgst = colNumber;
                                if (val === 'cess') colMap.cess = colNumber;
                            });
                        }
                    } else {
                        // We are in data rows now.
                        const gstin = row.getCell(colMap.gstin || -1).value;
                        const invNo = row.getCell(colMap.invNo || -1).value;

                        // Stop or skip if essential data is missing 
                        if (!gstin || !invNo) return;

                        let dateVal = row.getCell(colMap.date || -1).value;

                        const parseNum = (val) => {
                            if (!val) return 0;
                            if (typeof val === 'number') return val;
                            if (val.result) return Number(val.result);
                            return Number(val.toString().replace(/,/g, '')) || 0;
                        };

                        const taxable = parseNum(row.getCell(colMap.taxable || -1).value);
                        const igst = parseNum(row.getCell(colMap.igst || -1).value);
                        const cgst = parseNum(row.getCell(colMap.cgst || -1).value);
                        const sgst = parseNum(row.getCell(colMap.sgst || -1).value);
                        const cess = parseNum(row.getCell(colMap.cess || -1).value);
                        const totalTax = igst + cgst + sgst + cess;

                        if (dateVal && dateVal instanceof Date) {
                            dateVal = dateVal.toISOString().split('T')[0];
                        } else if (dateVal && typeof dateVal === 'object' && dateVal.result) {
                            dateVal = new Date(dateVal.result).toISOString().split('T')[0];
                        } else if (dateVal) {
                            dateVal = String(dateVal);
                        }

                        normalizedInvoices.push({
                            gstin: String(gstin).trim().toUpperCase(),
                            invNo: String(invNo).trim(),
                            date: dateVal,
                            taxable: taxable,
                            tax: totalTax,
                            section: 'B2B'
                        });
                    }
                });

                if (normalizedInvoices.length === 0) {
                    return res.status(400).json({ success: false, message: 'Upload valid Excel. And Sheet Name should be B2B.' });
                }

                // 3. Call Model to Reconcile
                const result = await GSTR2BReportModel.reconcile(userId, normalizedInvoices, fromDate, toDate);

                if (!result.success) {
                    return res.status(500).json(result);
                }

                res.status(200).json(result);

            } catch (error) {
                console.error('GSTR2BReportController Error:', error);

                // If it fails to parse the Excel file, output the same valid format message.
                res.status(400).json({
                    success: false,
                    message: 'Upload valid Excel. And Sheet Name should be B2B.',
                    error: error.message
                });
            }
        });
    }

    /**
     * Filter API for tab clicks
     * Note: Since reconciliation is potentially large and stateless here, 
     * this expects the results and status to be passed, or it can be a dummy that
     * returned filtered data IF results were stored.
     * To fulfill the requirement of "tab clicks call a filter API", 
     * we'll implement it to accept the data and return filtered or just returning success.
     */
    static async filterByStatus(req, res) {
        try {
            const { results, status } = req.body;
            if (!results || !status) {
                return res.status(400).json({ success: false, message: 'Results and status required' });
            }

            let filteredData = results;

            if (status === 'All') {
                filteredData = results;
            } else if (status === 'Matched') {
                filteredData = results.filter(item => item.status === 'Exact Matched' || item.status === 'Partially Matched');
            } else if (status === 'Not Matched') {
                filteredData = results.filter(item => item.status === 'Missing in 2B' || item.status === 'Missing in Purchase');
            } else {
                // Specific statuses: 'Exact Matched', 'Partially Matched', 'Missing in 2B', 'Missing in Purchase'
                filteredData = results.filter(item => item.status === status);
            }

            res.status(200).json({
                success: true,
                count: filteredData.length,
                data: filteredData
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = GSTR2BReportController;
