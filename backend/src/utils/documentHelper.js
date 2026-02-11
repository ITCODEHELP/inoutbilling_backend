const DispatchAddress = require('../models/Setting-Model/DispatchAddress');
const User = require('../models/User-Model/User');
const PrintTemplateSettings = require('../models/Setting-Model/PrintTemplateSetting');
const mongoose = require('mongoose');
const numberToWords = require('./numberToWords');

/**
 * Shared Backend Calculation Utility
 * @param {string} userId
 * @param {object} documentData - Data from req.body
 * @param {string} branchId - branch ObjectId
 */
const calculateDocumentTotals = async (userId, documentData, branchId = null) => {
    // 1. Resolve source state
    let sourceState = '';
    if (branchId) {
        if (typeof branchId === 'string' || mongoose.Types.ObjectId.isValid(branchId)) {
            const branch = await DispatchAddress.findOne({ _id: branchId, userRef: userId });
            if (branch) sourceState = branch.state;
        } else if (typeof branchId === 'object' && branchId.state) {
            sourceState = branchId.state;
        }
    }

    if (!sourceState) {
        const user = await User.findById(userId);
        if (user) sourceState = user.state;
    }

    // 2. Resolve destination state
    const info = documentData.customerInformation || documentData.vendorInformation || {};
    const destState = info.placeOfSupply || '';

    const isIntraState = sourceState && destState && sourceState.trim().toLowerCase() === destState.trim().toLowerCase();

    // 3. Process items
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalDiscount = 0;
    let totalInvoiceValue = 0; // Sum of final item totals before discount
    let totalTax = 0;

    const items = Array.isArray(documentData.items) ? documentData.items : [];
    console.log(`[CALC DEBUG] calculateDocumentTotals called with ${items.length} items`);

    const calculatedItems = items.map(item => {
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);

        const discount = Number(item.discount || item.discountValue || 0); // Accept both field names
        const discountType = item.discountType || 'Percentage';
        const igstRate = Number(item.igst || 0);

        console.log(`[ITEM DEBUG] Processing: ${item.productName || item.name || 'Unknown'}`);
        console.log(`  qty=${qty}, price=${price}, discount=${discount}, discountType=${discountType}, igst=${igstRate}`);

        // Step 1: Calculate base amount (qty × price)
        const baseAmount = qty * price;

        // Step 2: Calculate tax on base amount

        let cgst = 0, sgst = 0, igst = 0;
        let cgstRate = 0, sgstRate = 0, finalIgstRate = 0;

        if (isIntraState) {
            cgstRate = igstRate / 2;
            sgstRate = igstRate / 2;
            cgst = (baseAmount * cgstRate) / 100;
            sgst = (baseAmount * sgstRate) / 100;
        } else {
            finalIgstRate = igstRate;
            igst = (baseAmount * finalIgstRate) / 100;
        }

        const taxAmount = cgst + sgst + igst;

        // Step 3: Amount with tax (before discount)
        const amountWithTax = baseAmount + taxAmount;

        // Step 4: Calculate discount on final amount (after tax)
        let discountAmount = 0;
        if (discountType === 'Percentage') {
            discountAmount = amountWithTax * (discount / 100);
        } else {
            // Flat discount
            discountAmount = discount;
        }

        // Debug logging
        if (discount > 0) {
            console.log(`[DISCOUNT DEBUG] Item: ${item.productName || item.name || 'Unknown'}`);
            console.log(`  Base: ${baseAmount}, Tax: ${taxAmount}, AmountWithTax: ${amountWithTax}`);
            console.log(`  Discount: ${discount} (${discountType}), DiscountAmount: ${discountAmount}`);
        }

        // Step 5: Final item total (after discount)
        const finalItemTotal = amountWithTax - discountAmount;

        if (discount > 0) {
            console.log(`  FinalItemTotal: ${finalItemTotal} (should be ${amountWithTax} - ${discountAmount})`);
        }

        // Aggregate totals
        totalInvoiceValue += amountWithTax; // Total before discount
        totalDiscount += discountAmount;
        totalCGST += cgst;
        totalSGST += sgst;
        totalIGST += igst;
        totalTaxable += taxAmount;

        const taxableValue = baseAmount;

        return {
            ...item,
            hsnSac: item.hsnSac || item.hsnCode || "",
            qty, price, discount,
            discountType,
            baseAmount: Math.round(baseAmount * 100) / 100,
            taxableValue: Math.round(taxableValue * 100) / 100,
            discountAmount: Math.round(discountAmount * 100) / 100,
            igst: isIntraState ? 0 : finalIgstRate,
            cgst: isIntraState ? cgstRate : 0,
            sgst: isIntraState ? sgstRate : 0,
            total: Math.round(finalItemTotal * 100) / 100
        };
    });

    // 4. Additional Charges
    let totalTaxOnCharges = 0;
    let totalChargeAmount = 0;
    const additionalCharges = Array.isArray(documentData.additionalCharges) ? documentData.additionalCharges : [];
    additionalCharges.forEach(charge => {
        totalChargeAmount += Number(charge.amount || 0);
        totalTaxOnCharges += Number(charge.tax || 0);
    });

    // 5. Aggregates
    const sumOfItemTotals = calculatedItems.reduce((sum, item) => sum + item.total, 0);
    let grandTotal = sumOfItemTotals + totalChargeAmount + totalTaxOnCharges;

    const finalGrandTotal = Math.round(grandTotal);
    const roundOff = Math.round((finalGrandTotal - grandTotal) * 100) / 100;

    const totalTaxableForReporting = calculatedItems.reduce((sum, item) => sum + item.taxableValue, 0);
    return {
        items: calculatedItems,
        totals: {
            totalInvoiceValue: Math.round(totalInvoiceValue * 100) / 100, // Total with tax before discount
            totalDiscount: Math.round(totalDiscount * 100) / 100, // Total discount amount
            totalTaxable: Math.round(totalTaxableForReporting * 100) / 100, // Base amounts for reporting
            totalCGST: Math.round(totalCGST * 100) / 100,
            totalSGST: Math.round(totalSGST * 100) / 100,
            totalIGST: Math.round(totalIGST * 100) / 100,
            totalTax: Math.round(totalTax * 100) / 100,
            grandTotal: finalGrandTotal,
            roundOff: roundOff,
            totalInWords: numberToWords(finalGrandTotal)
        }
    };
};

/**
 * Reusable Summary Aggregation Helper
 */
const getSummaryAggregation = async (userId, query, Model) => {
    const summary = await Model.aggregate([
        { $match: query },
        {
            $group: {
                _id: null,
                totalTransactions: { $sum: 1 },
                totalTaxable: { $sum: '$totals.totalTaxable' },
                totalCGST: { $sum: '$totals.totalCGST' },
                totalSGST: { $sum: '$totals.totalSGST' },
                totalIGST: { $sum: '$totals.totalIGST' },
                totalValue: { $sum: '$totals.grandTotal' }
            }
        },
        {
            $project: {
                _id: 0,
                totalTransactions: { $ifNull: ['$totalTransactions', 0] },
                totalTaxable: { $ifNull: ['$totalTaxable', 0] },
                totalCGST: { $ifNull: ['$totalCGST', 0] },
                totalSGST: { $ifNull: ['$totalSGST', 0] },
                totalIGST: { $ifNull: ['$totalIGST', 0] },
                totalValue: { $ifNull: ['$totalValue', 0] }
            }
        }
    ]);

    return summary.length > 0 ? summary[0] : {
        totalTransactions: 0,
        totalTaxable: 0,
        totalCGST: 0,
        totalSGST: 0,
        totalIGST: 0,
        totalValue: 0
    };
};

/**
 * Export Invoice Calculation Utility
 * Handles tax logic: IGST entered by user, CGST/SGST derived from IGST when applicable
 * @param {string} userId
 * @param {object} documentData - Data from req.body
 * @param {string} invoiceType - 'Export Invoice (With IGST)' or 'Export Invoice (Without IGST)'
 * @param {string} currencyCode - Currency code (e.g., 'AED', 'USD')
 */
const calculateExportInvoiceTotals = async (userId, documentData, invoiceType, currencyCode = 'AED') => {
    // 3. Process items
    let totalTaxable = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;

    const items = Array.isArray(documentData.items) ? documentData.items : [];
    const isWithIGST = invoiceType === 'Export Invoice (With IGST)';

    const calculatedItems = items.map(item => {
        const qty = Number(item.qty || 0);
        const price = Number(item.price || 0);
        const discount = Number(item.discount || 0);
        const igstRate = Number(item.igst || 0); // IGST rate entered by user

        const taxableValue = qty * price * (1 - discount / 100);

        let cgst = 0, sgst = 0, igst = 0;
        let cgstRate = 0, sgstRate = 0, finalIgstRate = 0;

        if (isWithIGST && igstRate > 0) {
            // For export invoices with IGST, derive CGST/SGST from IGST when applicable
            // Typically exports use IGST only, but if business rule requires CGST/SGST:
            // CGST = IGST ÷ 2, SGST = IGST ÷ 2
            // For now, we'll use IGST directly for exports, but allow derivation if needed
            finalIgstRate = igstRate;
            igst = (taxableValue * finalIgstRate) / 100;

            // If business rule requires CGST/SGST derivation (uncomment if needed):
            // cgstRate = igstRate / 2;
            // sgstRate = igstRate / 2;
            // cgst = (taxableValue * cgstRate) / 100;
            // sgst = (taxableValue * sgstRate) / 100;
            // igst = 0; // Set IGST to 0 if using CGST/SGST
        } else {
            // Export Invoice (Without IGST) - no taxes
            finalIgstRate = 0;
            igst = 0;
        }

        const total = taxableValue + cgst + sgst + igst;

        totalTaxable += taxableValue;
        totalCGST += cgst;
        totalSGST += sgst;
        totalIGST += igst;

        return {
            ...item,
            hsnSac: item.hsnSac || item.hsnCode || "",
            qty, price, discount,
            taxableValue: Math.round(taxableValue * 100) / 100,
            igst: finalIgstRate,
            cgst: cgstRate,
            sgst: sgstRate,
            total: Math.round(total * 100) / 100
        };
    });

    // 4. Additional Charges
    let totalTaxOnCharges = 0;
    let totalChargeAmount = 0;
    const additionalCharges = Array.isArray(documentData.additionalCharges) ? documentData.additionalCharges : [];
    additionalCharges.forEach(charge => {
        totalChargeAmount += Number(charge.amount || 0);
        totalTaxOnCharges += Number(charge.tax || 0);
    });

    // 5. Aggregates
    const totalTax = totalCGST + totalSGST + totalIGST + totalTaxOnCharges;
    let grandTotal = totalTaxable + totalTax + totalChargeAmount;

    const finalGrandTotal = Math.round(grandTotal);
    const roundOff = Math.round((finalGrandTotal - grandTotal) * 100) / 100;

    // Get currency-aware number to words
    const numberToWordsModule = require('./numberToWords');
    const numberToWordsWithCurrency = numberToWordsModule.numberToWordsWithCurrency;
    const totalInWords = numberToWordsWithCurrency ? numberToWordsWithCurrency(finalGrandTotal, currencyCode) : numberToWords(finalGrandTotal);

    return {
        items: calculatedItems,
        totals: {
            totalTaxable: Math.round(totalTaxable * 100) / 100,
            totalCGST: Math.round(totalCGST * 100) / 100,
            totalSGST: Math.round(totalSGST * 100) / 100,
            totalIGST: Math.round(totalIGST * 100) / 100,
            totalTax: Math.round(totalTax * 100) / 100,
            grandTotal: finalGrandTotal,
            roundOff: roundOff,
            totalInWords: totalInWords
        }
    };
};

/**
 * Common Template Resolver
 * Checks database for user's selected template for a document type and branch.
 * @param {string} userId
 * @param {string} docType
 * @param {string} branchId - Optional branchId, defaults to 'main'
 * @returns {Promise<Object>} Selected template config
 */
const getSelectedPrintTemplate = async (userId, docType, branchId = 'main') => {
    try {
        // Normalize branchId to a string (use .ms or ._id if it's an object, or fallback to 'main')
        let branch = 'main';
        if (typeof branchId === 'string' && branchId.trim()) {
            branch = branchId;
        } else if (branchId && typeof branchId === 'object') {
            branch = branchId.ms || branchId.branchName || (branchId._id ? branchId._id.toString() : 'main');
        }

        const defaultSettings = {
            selectedTemplate: 'Default',
            printSize: 'A4',
            printOrientation: 'Portrait'
        };

        // If userId is not a valid ObjectId, it might be the custom string userId.
        // We need to resolve it to the User._id first because PrintTemplateSettings uses ObjectId.
        let resolvedUserId = userId;
        if (userId && typeof userId === 'string' && !mongoose.Types.ObjectId.isValid(userId)) {
            const User = mongoose.model('User');
            const foundUser = await User.findOne({ userId: userId }).select('_id').lean();
            if (foundUser) {
                resolvedUserId = foundUser._id;
            }
        }

        // Try to find settings for the specific branch
        let settings = await PrintTemplateSettings.findOne({ userId: resolvedUserId, branchId });

        // Fallback to 'main' if specific branch settings not found and branchId wasn't already 'main'
        if (!settings && branchId !== 'main') {
            settings = await PrintTemplateSettings.findOne({ userId: resolvedUserId, branchId: 'main' });
        }

        if (!settings || !settings.templateConfigurations) return defaultSettings;

        const config = settings.templateConfigurations.find(c => c.documentType === docType);
        if (!config || !config.selectedTemplate) return defaultSettings;

        return {
            selectedTemplate: config.selectedTemplate,
            printSize: config.printSize || 'A4',
            printOrientation: config.printOrientation || 'Portrait'
        };
    } catch (err) {
        console.error(`Error resolving template for ${docType} (Branch: ${branchId}):`, err);
        return {
            selectedTemplate: 'Default',
            printSize: 'A4',
            printOrientation: 'Portrait'
        };
    }
};

module.exports = {
    calculateDocumentTotals,
    calculateExportInvoiceTotals,
    getSummaryAggregation,
    numberToWords,
    getSelectedPrintTemplate
};
