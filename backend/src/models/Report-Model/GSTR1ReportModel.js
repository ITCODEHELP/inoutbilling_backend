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
            {
                $project: {
                    invoiceNo: '$invoiceDetails.invoiceNumber',
                    date: '$invoiceDetails.date',
                    invoiceValue: '$totals.grandTotal',
                    placeOfSupply: '$customerInformation.placeOfSupply',
                    taxableValue: '$totals.totalTaxable',
                    igst: '$totals.totalIGST',
                    taxAmount: '$totals.totalTax'
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
            {
                $group: {
                    _id: {
                        type: '$invoiceDetails.invoiceType',
                        pos: '$customerInformation.placeOfSupply',
                        taxRate: '$items.igst' // Simplified: grouping by rate needs unwinding
                    },
                    taxableValue: { $sum: '$totals.totalTaxable' },
                    igst: { $sum: '$totals.totalIGST' },
                    cgst: { $sum: '$totals.totalCGST' },
                    sgst: { $sum: '$totals.totalSGST' }
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
            {
                $project: {
                    exportType: '$invoiceDetails.invoiceType',
                    invoiceNo: '$invoiceDetails.invoiceNumber',
                    date: '$invoiceDetails.date',
                    invoiceValue: '$totals.grandTotal',
                    shippingBillNo: '$exportShippingDetails.shipBillNo',
                    shippingBillDate: '$exportShippingDetails.shipBillDate',
                    portCode: '$exportShippingDetails.shipPortCode',
                    taxableValue: '$totals.totalTaxable',
                    igst: '$totals.totalIGST'
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

        return [...cns.map(n => ({
            gstin: n.customerInformation.gstinPan,
            noteNo: n.creditNoteDetails.cnNumber,
            date: n.creditNoteDetails.cnDate,
            invoiceNo: n.creditNoteDetails.invoiceNumber,
            invoiceDate: n.creditNoteDetails.invoiceDate,
            type: 'C',
            value: n.totals.grandTotal,
            taxableValue: n.totals.totalTaxable,
            taxAmount: n.totals.totalTax
        })), ...dns.map(n => ({
            gstin: n.customerInformation.gstinPan,
            noteNo: n.debitNoteDetails.dnNumber,
            date: n.debitNoteDetails.dnDate,
            invoiceNo: n.debitNoteDetails.invoiceNumber,
            invoiceDate: n.debitNoteDetails.invoiceDate,
            type: 'D',
            value: n.totals.grandTotal,
            taxableValue: n.totals.totalTaxable,
            taxAmount: n.totals.totalTax
        }))];
    }

    // Section: CDNUR (Unregistered Credit/Debit Notes)
    static async getCDNURData(userId, fromDate, toDate) {
        const cnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'creditNoteDetails.cnDate'), 'customerInformation.gstinPan': { $in: [null, ''] } };
        const dnMatch = { userId: new mongoose.Types.ObjectId(userId), ...this.buildDateMatch(fromDate, toDate, 'debitNoteDetails.dnDate'), 'customerInformation.gstinPan': { $in: [null, ''] } };

        const cns = await CreditNote.find(cnMatch).lean();
        const dns = await DebitNote.find(dnMatch).lean();

        return [...cns.map(n => ({
            type: 'C',
            noteNo: n.creditNoteDetails.cnNumber,
            date: n.creditNoteDetails.cnDate,
            value: n.totals.grandTotal,
            taxableValue: n.totals.totalTaxable
        })), ...dns.map(n => ({
            type: 'D',
            noteNo: n.debitNoteDetails.dnNumber,
            date: n.debitNoteDetails.dnDate,
            value: n.totals.grandTotal,
            taxableValue: n.totals.totalTaxable
        }))];
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
                    hsn: '$_id.hsn',
                    description: 1,
                    uom: '$_id.uom',
                    totalQty: 1,
                    totalValue: 1,
                    taxableValue: 1,
                    igst: 1,
                    cgst: 1,
                    sgst: 1,
                    totalTax: { $add: ['$igst', '$cgst', '$sgst'] }
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
            nature: 'Invoices for outward supply',
            from: invoices[0].invoiceDetails.invoiceNumber,
            to: invoices[invoices.length - 1].invoiceDetails.invoiceNumber,
            totalCount: invoices.length,
            cancelledCount: 0 // Logic for cancelled depends on 'status' if exists
        }];
    }
}

module.exports = GSTR1ReportModel;
