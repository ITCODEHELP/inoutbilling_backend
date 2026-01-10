const mongoose = require('mongoose');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class GSTR2BReportModel {
    /**
     * Perform reconciliation between GSTR-2B JSON and Purchase Invoices
     * @param {string} userId - User ID
     * @param {Array} jsonInvoices - Normalized invoices from GSTR-2B JSON
     * @param {Date} fromDate - Start date
     * @param {Date} toDate - End date
     */
    static async reconcile(userId, jsonInvoices, fromDate, toDate) {
        try {
            // 1. Fetch Purchase Invoices for the period
            const query = { userId: new mongoose.Types.ObjectId(userId) };
            if (fromDate || toDate) {
                query['invoiceDetails.date'] = {};
                if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
                if (toDate) {
                    const end = new Date(toDate);
                    end.setHours(23, 59, 59, 999);
                    query['invoiceDetails.date'].$lte = end;
                }
            }

            const dbInvoices = await PurchaseInvoice.find(query).lean();

            // 2. Reconciliation Engine
            const matchedIds = new Set();
            const jsonMatchedIds = new Set();
            const reconciliationResults = [];

            // Helper to normalize Inv No for comparison (remove special chars, leading zeros)
            const normalize = (val) => val ? val.toString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase().replace(/^0+/, '') : '';

            // Map DB Invoices for easier lookup
            const dbMap = dbInvoices.map(inv => ({
                id: inv._id,
                gstin: inv.vendorInformation.gstinPan ? inv.vendorInformation.gstinPan.toUpperCase() : '',
                invNo: normalize(inv.invoiceDetails.invoiceNumber),
                rawInvNo: inv.invoiceDetails.invoiceNumber,
                date: new Date(inv.invoiceDetails.date).toDateString(),
                taxable: Number(inv.totals.totalTaxable).toFixed(2),
                tax: Number(inv.totals.totalTax).toFixed(2),
                grandTotal: Number(inv.totals.grandTotal).toFixed(2),
                raw: inv
            }));

            // Map JSON Invoices
            const jsonMap = jsonInvoices.map((inv, index) => ({
                index,
                gstin: inv.gstin ? inv.gstin.toUpperCase() : '',
                invNo: normalize(inv.invNo),
                rawInvNo: inv.invNo,
                date: new Date(inv.date).toDateString(),
                taxable: Number(inv.taxable).toFixed(2),
                tax: Number(inv.tax).toFixed(2),
                raw: inv
            }));

            // --- Matching Loop ---
            jsonMap.forEach(jsonInv => {
                // Find potential matches in DB by GSTIN and Normalized Invoice Number
                const potentialMatches = dbMap.filter(dbInv =>
                    dbInv.gstin === jsonInv.gstin && dbInv.invNo === jsonInv.invNo
                );

                if (potentialMatches.length > 0) {
                    // Try to find Exact Match
                    const exactMatch = potentialMatches.find(dbInv =>
                        dbInv.taxable === jsonInv.taxable && dbInv.date === jsonInv.date
                    );

                    if (exactMatch) {
                        reconciliationResults.push({
                            status: 'Exact Matched',
                            purchase: exactMatch.raw,
                            gstr2b: jsonInv.raw
                        });
                        matchedIds.add(exactMatch.id.toString());
                        jsonMatchedIds.add(jsonInv.index);
                    } else {
                        // Partially Matched (Taxable value or Date differs)
                        const partialMatch = potentialMatches[0]; // Take the first one sharing GSTIN/InvNo
                        reconciliationResults.push({
                            status: 'Partially Matched',
                            purchase: partialMatch.raw,
                            gstr2b: jsonInv.raw,
                            differences: {
                                taxable: partialMatch.taxable !== jsonInv.taxable,
                                date: partialMatch.date !== jsonInv.date
                            }
                        });
                        matchedIds.add(partialMatch.id.toString());
                        jsonMatchedIds.add(jsonInv.index);
                    }
                }
            });

            // 3. Identify "Missing in Purchase" (In 2B but not in DB)
            jsonMap.forEach(jsonInv => {
                if (!jsonMatchedIds.has(jsonInv.index)) {
                    reconciliationResults.push({
                        status: 'Missing in Purchase',
                        purchase: null,
                        gstr2b: jsonInv.raw
                    });
                }
            });

            // 4. Identify "Missing in 2B" (In DB but not in 2B)
            dbMap.forEach(dbInv => {
                if (!matchedIds.has(dbInv.id.toString())) {
                    reconciliationResults.push({
                        status: 'Missing in 2B',
                        purchase: dbInv.raw,
                        gstr2b: null
                    });
                }
            });

            // 5. Calculate Summary
            const summary = {
                exactMatched: reconciliationResults.filter(r => r.status === 'Exact Matched').length,
                partiallyMatched: reconciliationResults.filter(r => r.status === 'Partially Matched').length,
                missingInPurchase: reconciliationResults.filter(r => r.status === 'Missing in Purchase').length,
                missingIn2B: reconciliationResults.filter(r => r.status === 'Missing in 2B').length,
                totalRecords: reconciliationResults.length
            };

            return {
                success: true,
                data: reconciliationResults,
                summary
            };

        } catch (error) {
            console.error('GSTR2BReportModel Error:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }
}

module.exports = GSTR2BReportModel;
