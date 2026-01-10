const GSTR2BReportModel = require('../../models/Report-Model/GSTR2BReportModel');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for JSON file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() === '.json') {
            cb(null, true);
        } else {
            cb(new Error('Only .json files are allowed'));
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
                return res.status(400).json({ success: false, message: err.message });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Please upload a GSTR-2B JSON file' });
            }

            try {
                const { fromDate, toDate } = req.body;
                const userId = req.user._id;

                // 1. Parse JSON content
                const jsonContent = JSON.parse(req.file.buffer.toString());

                // 2. Normalize GST JSON structure to flat list
                // Standard GSTR-2B sections under 'itc_avl' or 'itc_unavl'
                const normalizedInvoices = [];

                const processSection = (sectionData) => {
                    if (!sectionData) return;

                    // B2B Section
                    if (sectionData.b2b) {
                        sectionData.b2b.forEach(vendor => {
                            const ctin = vendor.ctin;
                            vendor.inv.forEach(inv => {
                                normalizedInvoices.push({
                                    gstin: ctin,
                                    invNo: inv.inum,
                                    date: inv.idt, // DD-MM-YYYY or others, Model uses new Date()
                                    taxable: inv.txval,
                                    tax: (inv.iamt || 0) + (inv.camt || 0) + (inv.samt || 0) + (inv.csamt || 0),
                                    section: 'B2B'
                                });
                            });
                        });
                    }

                    // CDNR Section
                    if (sectionData.cdnr) {
                        sectionData.cdnr.forEach(vendor => {
                            const ctin = vendor.ctin;
                            vendor.nt.forEach(nt => {
                                normalizedInvoices.push({
                                    gstin: ctin,
                                    invNo: nt.nt_num,
                                    date: nt.nt_dt,
                                    taxable: nt.txval,
                                    tax: (nt.iamt || 0) + (nt.camt || 0) + (nt.samt || 0) + (nt.csamt || 0),
                                    section: 'CDNR'
                                });
                            });
                        });
                    }
                };

                if (jsonContent.itc_avl) processSection(jsonContent.itc_avl);
                if (jsonContent.itc_unavl) processSection(jsonContent.itc_unavl);

                // If JSON is not in standard GSTR-2B format but is a flat list (custom/simple)
                if (normalizedInvoices.length === 0 && Array.isArray(jsonContent)) {
                    jsonContent.forEach(item => {
                        normalizedInvoices.push({
                            gstin: item.gstin,
                            invNo: item.invNo || item.inum,
                            date: item.date || item.idt,
                            taxable: item.taxable || item.txval,
                            tax: item.tax || ((item.iamt || 0) + (item.camt || 0) + (item.samt || 0)),
                            section: 'Unknown'
                        });
                    });
                }

                // 3. Call Model to Reconcile
                const result = await GSTR2BReportModel.reconcile(userId, normalizedInvoices, fromDate, toDate);

                if (!result.success) {
                    return res.status(500).json(result);
                }

                res.status(200).json(result);

            } catch (error) {
                console.error('GSTR2BReportController Error:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to process file',
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

            const filteredData = status === 'All'
                ? results
                : results.filter(item => item.status === status);

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
