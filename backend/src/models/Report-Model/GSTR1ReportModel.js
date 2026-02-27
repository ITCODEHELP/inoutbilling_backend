const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const CreditNote = require('../Other-Document-Model/CreditNote');
const DebitNote = require('../Other-Document-Model/DebitNote');
const ExportInvoice = require('../Other-Document-Model/Multi-CurrencyExportInvoice');
const InwardPayment = require('../Payment-Model/InwardPayment');

class GSTR1ReportModel {

    static buildDateMatch(fromDate, toDate, field = 'invoiceDetails.date') {
        const match = {};
        if (fromDate) match.$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            match.$lte = end;
        }
        return { [field]: match };
    }

    // Section: B2B (Registered Customers)
    static async getB2BData(userId, fromDate, toDate) {
        return SaleInvoice.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    ...this.buildDateMatch(fromDate, toDate),
                    'customerInformation.gstinPan': { $exists: true, $ne: '' }
                }
            },
            {
                $project: {
                    gstin: '$customerInformation.gstinPan',
                    customerName: '$customerInformation.ms',
                    invoiceNo: '$invoiceDetails.invoiceNumber',
                    invoiceDate: '$invoiceDetails.date',
                    date: '$invoiceDetails.date',
                    invoiceValue: '$totals.grandTotal',
                    placeOfSupply: '$customerInformation.placeOfSupply',
                    reverseCharge: '$customerInformation.reverseCharge',
                    invoiceType: '$invoiceDetails.invoiceType',
                    taxableValue: '$totals.totalTaxable',
                    igst: '$totals.totalIGST',
                    cgst: '$totals.totalCGST',
                    sgst: '$totals.totalSGST',
                    taxAmount: '$totals.totalTax'
                }
            }
        ]);
    }

    // Section: B2CL (Inter-state, B2C, > 2.5L)
    static async getB2CLData(userId, fromDate, toDate, userState) {
        return SaleInvoice.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    ...this.buildDateMatch(fromDate, toDate),
                    'customerInformation.gstinPan': { $in: [null, ''] },
                    'totals.grandTotal': { $gt: 250000 },
                    'customerInformation.placeOfSupply': { $ne: userState }
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: {
                        invoiceId: '$_id',
                        rate: '$items.igst' // B2CL is inter-state, so IGST is the rate
                    },
                    invoiceNumber: { $first: '$invoiceDetails.invoiceNumber' },
                    invoiceDate: { $first: '$invoiceDetails.date' },
                    invoiceValue: { $first: '$totals.grandTotal' },
                    placeOfSupply: { $first: '$customerInformation.placeOfSupply' },
                    taxableValue: { $sum: '$items.taxableValue' }
                }
            },
            {
                $project: {
                    _id: 0,
                    invoiceNumber: 1,
                    invoiceDate: 1,
                    invoiceValue: 1,
                    placeOfSupply: 1,
                    applicableTaxRate: { $literal: '' },
                    rate: '$_id.rate',
                    taxableValue: 1,
                    cessAmount: { $literal: 0 },
                    ecommerceGstin: { $literal: '' },
                    // Aliases to ensure UI matching if it uses older B2B keys
                    invoiceNo: '$invoiceNumber',
                    date: '$invoiceDate'
                }
            }
        ]);
    }

    // Section: B2CS (B2C, Small)
    static async getB2CSData(userId, fromDate, toDate, userState) {
        return SaleInvoice.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    ...this.buildDateMatch(fromDate, toDate),
                    'customerInformation.gstinPan': { $in: [null, ''] },
                    $or: [
                        { 'totals.grandTotal': { $lte: 250000 } },
                        { 'customerInformation.placeOfSupply': userState }
                    ]
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: {
                        type: '$invoiceDetails.invoiceType',
                        pos: '$customerInformation.placeOfSupply',
                        taxRate: { $add: ['$items.igst', '$items.cgst', '$items.sgst'] } // Total tax percentage
                    },
                    taxableValue: { $sum: '$items.taxableValue' },
                    igst: { $sum: '$items.igst' },
                    cgst: { $sum: '$items.cgst' },
                    sgst: { $sum: '$items.sgst' }
                }
            },
            {
                $project: {
                    _id: 0,
                    type: 'OE', // Standard GSTR1 type for B2CS
                    placeOfSupply: '$_id.pos',
                    applicableTaxRate: { $literal: '' },
                    rate: '$_id.taxRate',
                    taxableValue: 1,
                    cessAmount: { $literal: 0 },
                    ecommerceGstin: { $literal: '' }
                }
            }
        ]);
    }

    // Section: EXP (Exports)
    static async getEXPData(userId, fromDate, toDate) {
        return ExportInvoice.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    ...this.buildDateMatch(fromDate, toDate, 'invoiceDetails.date')
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: {
                        invoiceId: '$_id',
                        rate: '$items.igst' // Export usually IGST
                    },
                    exportType: { $first: '$invoiceDetails.invoiceType' },
                    invoiceNo: { $first: '$invoiceDetails.invoiceNumber' },
                    invoiceDate: { $first: '$invoiceDetails.date' },
                    invoiceValue: { $first: '$totals.grandTotal' },
                    shippingBillNo: { $first: '$exportShippingDetails.shipBillNo' },
                    shippingBillDate: { $first: '$exportShippingDetails.shipBillDate' },
                    portCode: { $first: '$exportShippingDetails.shipPortCode' },
                    taxableValue: { $sum: '$items.taxableValue' }
                }
            },
            {
                $project: {
                    _id: 0,
                    exportType: 1,
                    invoiceNo: 1,
                    invoiceDate: 1,
                    date: '$invoiceDate',
                    invoiceValue: 1,
                    portCode: 1,
                    shippingBillNo: { $ifNull: ['$shippingBillNo', ''] },
                    shippingBillDate: { $ifNull: ['$shippingBillDate', null] },
                    rate: '$_id.rate',
                    taxableValue: 1,
                    cessAmount: { $literal: 0 }
                }
            }
        ]);
    }

    // Section: CDNR (Registered Credit/Debit Notes)
    static async getCDNRData(userId, fromDate, toDate) {
        const cnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'creditNoteDetails.cnDate'), 'customerInformation.gstinPan': { $exists: true, $ne: '' } };
        const dnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'debitNoteDetails.dnDate'), 'customerInformation.gstinPan': { $exists: true, $ne: '' } };

        const cns = await CreditNote.find(cnMatch).lean();
        const dns = await DebitNote.find(dnMatch).lean();

        const processNotes = (notes, noteType, detailKey, numKey, dateKey) => {
            const results = [];
            for (const n of notes) {
                const rateGroups = {};
                for (const item of n.items || []) {
                    const rate = (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0);
                    if (!rateGroups[rate]) rateGroups[rate] = { taxableValue: 0 };
                    // Estimating taxable value from qty, price, discount
                    const itemTaxable = (item.qty || 0) * (item.price || 0) - (item.discount || 0);
                    rateGroups[rate].taxableValue += itemTaxable;
                }

                if (Object.keys(rateGroups).length === 0) {
                    rateGroups[0] = { taxableValue: n.totals?.totalTaxable || 0 };
                }

                for (const [rateStr, vals] of Object.entries(rateGroups)) {
                    results.push({
                        gstin: n.customerInformation?.gstinPan || '',
                        receiverName: n.customerInformation?.ms || '',
                        noteNo: n[detailKey][numKey],
                        noteDate: n[detailKey][dateKey],
                        invoiceNo: n[detailKey].invoiceNumber,
                        invoiceDate: n[detailKey].invoiceDate,
                        noteType: noteType,
                        placeOfSupply: n.customerInformation?.placeOfSupply || '',
                        reverseCharge: n.customerInformation?.reverseCharge ? 'Y' : 'N',
                        noteSupplyType: 'Regular', // Standard default for GSTR1
                        noteValue: n.totals?.grandTotal || 0,
                        applicableTaxRate: '',
                        rate: Number(rateStr),
                        taxableValue: vals.taxableValue,
                        cessAmount: 0 // Default cess
                    });
                }
            }
            return results;
        };

        return [
            ...processNotes(cns, 'C', 'creditNoteDetails', 'cnNumber', 'cnDate'),
            ...processNotes(dns, 'D', 'debitNoteDetails', 'dnNumber', 'dnDate')
        ];
    }

    // Section: CDNUR (Unregistered Credit/Debit Notes)
    static async getCDNURData(userId, fromDate, toDate) {
        const cnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'creditNoteDetails.cnDate'), 'customerInformation.gstinPan': { $in: [null, ''] } };
        const dnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'debitNoteDetails.dnDate'), 'customerInformation.gstinPan': { $in: [null, ''] } };

        const cns = await CreditNote.find(cnMatch).lean();
        const dns = await DebitNote.find(dnMatch).lean();

        const processNotes = (notes, noteType, detailKey, numKey, dateKey) => {
            const results = [];
            for (const n of notes) {
                const rateGroups = {};
                for (const item of n.items || []) {
                    const rate = (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0);
                    if (!rateGroups[rate]) rateGroups[rate] = { taxableValue: 0 };
                    const itemTaxable = (item.qty || 0) * (item.price || 0) - (item.discount || 0);
                    rateGroups[rate].taxableValue += itemTaxable;
                }

                if (Object.keys(rateGroups).length === 0) {
                    rateGroups[0] = { taxableValue: n.totals?.totalTaxable || 0 };
                }

                for (const [rateStr, vals] of Object.entries(rateGroups)) {
                    results.push({
                        urType: 'B2CL', // Assuming B2CL/B2CS based on value, default B2CS
                        noteNo: n[detailKey][numKey],
                        noteDate: n[detailKey][dateKey],
                        noteType: noteType,
                        placeOfSupply: n.customerInformation?.placeOfSupply || '',
                        noteValue: n.totals?.grandTotal || 0,
                        applicableTaxRate: '',
                        rate: Number(rateStr),
                        taxableValue: vals.taxableValue,
                        cessAmount: 0
                    });
                }
            }
            return results;
        };

        return [
            ...processNotes(cns, 'C', 'creditNoteDetails', 'cnNumber', 'cnDate'),
            ...processNotes(dns, 'D', 'debitNoteDetails', 'dnNumber', 'dnDate')
        ];
    }

    // Section: EXEMP (Nil Rated/Exempted/Non-GST Supplies)
    static async getEXEMPData(userId, fromDate, toDate, userState) {
        // GSTR-1 Nil Rated / Exempted summary is grouped by intra-state/inter-state and registered/unregistered

        // Let's summarize SaleInvoice items that are Nil Rated (0% tax) or specifically marked
        const invoices = await SaleInvoice.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    ...this.buildDateMatch(fromDate, toDate)
                }
            },
            { $unwind: '$items' },
            {
                // Find items that have 0 rate. We'll categorize them.
                $match: {
                    $or: [
                        { 'items.igst': 0, 'items.cgst': 0, 'items.sgst': 0 },
                        { 'items.taxableValue': { $gt: 0 } } // Also get them if rate is 0 to be safe
                    ]
                }
            }
        ]);

        // A basic mapping for EXEMP data required rows:
        // 1. Inter-State supplies to registered persons
        // 2. Intra-State supplies to registered persons
        // 3. Inter-State supplies to unregistered persons
        // 4. Intra-State supplies to unregistered persons

        const rows = {
            'Inter-State supplies to registered persons': { description: 'Inter-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
            'Intra-State supplies to registered persons': { description: 'Intra-State supplies to registered persons', nilRated: 0, exempted: 0, nonGst: 0 },
            'Inter-State supplies to unregistered persons': { description: 'Inter-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 },
            'Intra-State supplies to unregistered persons': { description: 'Intra-State supplies to unregistered persons', nilRated: 0, exempted: 0, nonGst: 0 },
        };

        for (const inv of invoices) {
            const item = inv.items;
            const rate = (item.igst || 0) + (item.cgst || 0) + (item.sgst || 0);

            // In typical GSTR logic, if rate is 0, we classify it as Nil Rated or Exempted
            // For now, if rate == 0, we put it in nilRated. 
            // We can check itemNote or product metadata if there's a strict difference, but this covers 99% of use cases.
            if (rate === 0) {
                const isRegistered = inv.customerInformation?.gstinPan ? true : false;
                const isInterState = inv.customerInformation?.placeOfSupply !== userState;
                const value = (item.qty || 0) * (item.price || 0) - (item.discount || 0);

                if (isInterState && isRegistered) {
                    rows['Inter-State supplies to registered persons'].nilRated += value;
                } else if (!isInterState && isRegistered) {
                    rows['Intra-State supplies to registered persons'].nilRated += value;
                } else if (isInterState && !isRegistered) {
                    rows['Inter-State supplies to unregistered persons'].nilRated += value;
                } else if (!isInterState && !isRegistered) {
                    rows['Intra-State supplies to unregistered persons'].nilRated += value;
                }
            }
        }

        return Object.values(rows);
    }

    // Section: HSN Summary
    static async getHSNData(userId, fromDate, toDate) {
        return SaleInvoice.aggregate([
            { $match: { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate) } },
            { $unwind: '$items' },
            {
                $group: {
                    _id: { hsn: '$items.hsnSac', uom: '$items.uom', rate: '$items.igst' },
                    description: { $first: '$items.productName' },
                    totalQty: { $sum: '$items.qty' },
                    totalValue: { $sum: '$items.total' },
                    taxableValue: { $sum: { $multiply: ['$items.qty', '$items.price'] } },
                    igst: { $sum: '$items.igst' },
                    cgst: { $sum: '$items.cgst' },
                    sgst: { $sum: '$items.sgst' }
                }
            },
            {
                $project: {
                    _id: 0,
                    hsn: '$_id.hsn',
                    description: { $ifNull: ['$description', ''] },
                    uqc: '$_id.uom',
                    totalQuantity: '$totalQty',
                    totalValue: 1,
                    rate: '$_id.rate',
                    taxableValue: 1,
                    integratedTaxAmount: '$igst',
                    centralTaxAmount: '$cgst',
                    stateUtTaxAmount: '$sgst',
                    cessAmount: { $literal: 0 }
                }
            }
        ]);
    }

    // Section: DOCS (Document Summary)
    static async getDOCSData(userId, fromDate, toDate) {
        // This usually requires identifying sequences. 
        // We'll return a count and min/max for the period.
        const invoices = await SaleInvoice.find({ userId, ...this.buildDateMatch(fromDate, toDate) }).sort({ 'invoiceDetails.invoiceNumber': 1 }).lean();
        if (invoices.length === 0) return [];

        return [{
            natureOfDocument: 'Invoices for outward supply',
            srNoFrom: invoices[0].invoiceDetails.invoiceNumber,
            srNoTo: invoices[invoices.length - 1].invoiceDetails.invoiceNumber,
            totalNumber: invoices.length,
            cancelled: 0 // Logic for cancelled depends on 'status' if exists
        }];
    }

    // --- REPORT ACTION HELPER INTEGRATION ---
    /**
     * Entry point for ReportActionController
     * @param {Object} filters req.body.filters (e.g. fromDate, toDate, section, isQuarterly)
     * @param {Object} options req.body.options 
     */
    static async getGSTR1ReportActionData(filters, options) {
        try {
            const { userId, fromDate, toDate, section, isQuarterly } = filters;

            if (!userId || !fromDate || !toDate || !section) {
                return { success: false, message: 'Missing required parameters: userId, fromDate, toDate, section' };
            }

            let finalData = [];

            // Resolve State for EXEMP or other logic
            const user = await mongoose.model('User').findById(userId).lean();
            const userState = user?.companyDetails?.state || user?.companyState || '';

            // Handle Quarterly Logic mapping
            const isQ = isQuarterly === true || String(isQuarterly).toLowerCase() === 'true';

            if (isQ) {
                // If it's quarterly, we fetch all data within the range 
                // but we must divide the specified date range into quarters.
                const start = new Date(fromDate);
                const end = new Date(toDate);

                // Helper to get quarter start/end
                const getQuarters = (startDate, endDate) => {
                    let qs = [];
                    let currentStart = new Date(startDate);
                    while (currentStart <= endDate) {
                        let currentEnd = new Date(currentStart);
                        currentEnd.setMonth(currentEnd.getMonth() + 3);
                        currentEnd.setDate(0); // Last day of that 3-month block

                        if (currentEnd > endDate) currentEnd = new Date(endDate);

                        qs.push({ start: new Date(currentStart), end: new Date(currentEnd) });

                        currentStart = new Date(currentEnd);
                        currentStart.setDate(currentStart.getDate() + 1); // Move to next day
                    }
                    return qs;
                };

                const quarters = getQuarters(start, end);

                for (let i = 0; i < quarters.length; i++) {
                    const qStart = quarters[i].start.toISOString().split('T')[0];
                    const qEnd = quarters[i].end.toISOString().split('T')[0];

                    const qData = await this.getSectionData(section, userId, qStart, qEnd, userState);

                    // Optional: You could inject a "Quarter" column if needed by the frontend exported excel
                    // For now, we just append the raw combined data.
                    finalData = finalData.concat(qData);
                }
            } else {
                // Normal fetch
                finalData = await this.getSectionData(section, userId, fromDate, toDate, userState);
            }

            const columnMap = {
                'B2B': [
                    { field: 'gstin', label: 'GSTIN/UIN of Recipient' },
                    { field: 'customerName', label: 'Receiver Name' },
                    { field: 'invoiceNo', label: 'Invoice Number' },
                    { field: 'date', label: 'Invoice date' },
                    { field: 'invoiceValue', label: 'Invoice Value' },
                    { field: 'placeOfSupply', label: 'Place Of Supply' },
                    { field: 'reverseCharge', label: 'Reverse Charge' },
                    { field: 'applicableTaxRate', label: 'Applicable % of Tax Rate' },
                    { field: 'invoiceType', label: 'Invoice Type' },
                    { field: 'ecommerceGstin', label: 'E-Commerce GSTIN' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' }
                ],
                'B2CL': [
                    { field: 'invoiceNumber', label: 'Invoice Number' },
                    { field: 'invoiceDate', label: 'Invoice date' },
                    { field: 'invoiceValue', label: 'Invoice Value' },
                    { field: 'placeOfSupply', label: 'Place Of Supply' },
                    { field: 'applicableTaxRate', label: 'Applicable % of Tax Rate' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' },
                    { field: 'ecommerceGstin', label: 'E-Commerce GSTIN' }
                ],
                'B2CS': [
                    { field: 'type', label: 'Type' },
                    { field: 'placeOfSupply', label: 'Place Of Supply' },
                    { field: 'applicableTaxRate', label: 'Applicable % of Tax Rate' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' },
                    { field: 'ecommerceGstin', label: 'E-Commerce GSTIN' }
                ],
                'CDNR': [
                    { field: 'gstin', label: 'GSTIN/UIN of Recipient' },
                    { field: 'receiverName', label: 'Receiver Name' },
                    { field: 'noteNo', label: 'Note Number' },
                    { field: 'noteDate', label: 'Note Date' },
                    { field: 'invoiceNo', label: 'Invoice Number' },
                    { field: 'invoiceDate', label: 'Invoice date' },
                    { field: 'noteType', label: 'Note Type' },
                    { field: 'placeOfSupply', label: 'Place Of Supply' },
                    { field: 'reverseCharge', label: 'Reverse Charge' },
                    { field: 'noteSupplyType', label: 'Note Supply Type' },
                    { field: 'noteValue', label: 'Note Value' },
                    { field: 'applicableTaxRate', label: 'Applicable % of Tax Rate' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' }
                ],
                'CDNUR': [
                    { field: 'urType', label: 'UR Type' },
                    { field: 'noteNo', label: 'Note Number' },
                    { field: 'noteDate', label: 'Note Date' },
                    { field: 'noteType', label: 'Note Type' },
                    { field: 'placeOfSupply', label: 'Place Of Supply' },
                    { field: 'noteValue', label: 'Note Value' },
                    { field: 'applicableTaxRate', label: 'Applicable % of Tax Rate' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' }
                ],
                'EXP': [
                    { field: 'exportType', label: 'Export Type' },
                    { field: 'invoiceNo', label: 'Invoice Number' },
                    { field: 'date', label: 'Invoice date' },
                    { field: 'invoiceValue', label: 'Invoice Value' },
                    { field: 'portCode', label: 'Port Code' },
                    { field: 'shippingBillNo', label: 'Shipping Bill Number' },
                    { field: 'shippingBillDate', label: 'Shipping Bill Date' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'cessAmount', label: 'Cess Amount' }
                ],
                'EXEMP': [
                    { field: 'description', label: 'Description' },
                    { field: 'nilRated', label: 'Nil Rated Supplies' },
                    { field: 'exempted', label: 'Exempted' },
                    { field: 'nonGst', label: 'Non-GST supplies' }
                ],
                'HSN_B2B': [
                    { field: 'hsn', label: 'HSN' },
                    { field: 'description', label: 'Description' },
                    { field: 'uqc', label: 'UQC' },
                    { field: 'totalQuantity', label: 'Total Quantity' },
                    { field: 'totalValue', label: 'Total Value' },
                    { field: 'rate', label: 'Rate' },
                    { field: 'taxableValue', label: 'Taxable Value' },
                    { field: 'integratedTaxAmount', label: 'Integrated Tax Amount' },
                    { field: 'centralTaxAmount', label: 'Central Tax Amount' },
                    { field: 'stateUtTaxAmount', label: 'State/UT Tax Amount' },
                    { field: 'cessAmount', label: 'Cess Amount' }
                ],
                'DOCS': [
                    { field: 'natureOfDocument', label: 'Nature of Document' },
                    { field: 'srNoFrom', label: 'Sr. No. From' },
                    { field: 'srNoTo', label: 'Sr. No. To' },
                    { field: 'totalNumber', label: 'Total Number' },
                    { field: 'cancelled', label: 'Cancelled' }
                ]
            };

            columnMap['HSN_B2C'] = columnMap['HSN_B2B']; // Same template for both

            return {
                success: true,
                data: {
                    docs: finalData,
                    totalDocs: finalData.length,
                    page: 1,
                    columns: columnMap[section] || []
                }
            };

        } catch (error) {
            console.error('getGSTR1ReportActionData Error:', error);
            return { success: false, message: error.message };
        }
    }

    // Router for specific sections
    static async getSectionData(section, userId, fromDate, toDate, userState) {
        switch (section) {
            case 'B2B': return await this.getB2BData(userId, fromDate, toDate);
            case 'B2CL': return await this.getB2CLData(userId, fromDate, toDate, userState);
            case 'B2CS': return await this.getB2CSData(userId, fromDate, toDate, userState);
            case 'CDNR': return await this.getCDNRData(userId, fromDate, toDate);
            case 'CDNUR': return await this.getCDNURData(userId, fromDate, toDate);
            case 'EXP': return await this.getEXPData(userId, fromDate, toDate);
            case 'HSN_B2B':
            case 'HSN_B2C':
                return await this.getHSNData(userId, fromDate, toDate);
            case 'DOCS': return await this.getDOCSData(userId, fromDate, toDate);
            case 'EXEMP': return await this.getEXEMPData(userId, fromDate, toDate, userState);
            case 'AT':
            case 'ATADJ':
                return []; // Placeholders
            default:
                throw new Error('Invalid section provided for GSTR-1 Excel/Email output');
        }
    }
}

module.exports = GSTR1ReportModel;
