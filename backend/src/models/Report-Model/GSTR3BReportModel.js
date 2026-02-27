const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const CreditNote = require('../Other-Document-Model/CreditNote');
const DebitNote = require('../Other-Document-Model/DebitNote');

class GSTR3BReportModel {
    /**
     * Helper to safely get numeric values
     */
    static getNum(val) {
        return Number(val) || 0;
    }

    /**
     * Get start and end date of the month/range safely
     */
    static getDateFilter(fromDate, toDate) {
        const query = {};
        if (fromDate) query.$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query.$lte = end;
        }
        return Object.keys(query).length > 0 ? query : null;
    }

    /**
     * Fetch all relevant transactions for the given period
     */
    static async fetchTransactions(userId, fromDate, toDate) {
        const dateFilter = this.getDateFilter(fromDate, toDate);
        const userQuery = { userId };
        if (dateFilter) userQuery['invoiceDetails.date'] = dateFilter;

        const sales = await SaleInvoice.find(userQuery).lean();
        const purchases = await PurchaseInvoice.find(userQuery).lean();
        const creditNotes = await CreditNote.find(userQuery).lean();
        const debitNotes = await DebitNote.find(userQuery).lean();

        // Also fetch user details for state
        const User = require('../User-Model/User');
        const user = await User.findById(userId).lean();
        const userState = user?.companyDetails?.state || user?.companyState || '';

        return { sales, purchases, creditNotes, debitNotes, userState };
    }

    /**
     * Checks if a supply is Inter-State
     */
    static isInterState(userState, placeOfSupply) {
        if (!userState || !placeOfSupply) return false;
        return String(userState).trim().toLowerCase() !== String(placeOfSupply).trim().toLowerCase();
    }

    /**
     * Generate the complete dynamic GSTR-3B structured data
     */
    static async getGSTR3BData(userId, fromDate, toDate) {
        const { sales, purchases, creditNotes, debitNotes, userState } = await this.fetchTransactions(userId, fromDate, toDate);

        // --- Initialize Sections ---
        // Section 3.1
        const s3_1 = {
            outwardTaxable: { desc: "(a) Outward Taxable supplies (other than zero rated, nil rated and exempted)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
            outwardZero: { desc: "(b) Outward Taxable supplies (zero rated)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
            outwardOther: { desc: "(c) Other Outward Taxable supplies (Nil rated, exempted)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
            inwardRev: { desc: "(d) Inward supplies (liable to reverse charge)", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
            nonGST: { desc: "(e) Non-GST Outward supplies", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 }
        };

        // Section 4
        const s4 = {
            A_importGoods: { desc: "(1) Import of goods", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            A_importServices: { desc: "(2) Import of services", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            A_inwardRev: { desc: "(3) Inward supplies liable to reverse charge", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            A_inwardISD: { desc: "(4) Inward supplies from ISD", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            A_allOther: { desc: "(5) All other ITC", igst: 0, cgst: 0, sgst: 0, cess: 0 },

            B_rule42: { desc: "(1) As per Rule 42 & 43 of SGST/CGST rules", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            B_others: { desc: "(2) Others", igst: 0, cgst: 0, sgst: 0, cess: 0 },

            D_section175: { desc: "(1) As per section 17(5) of CGST/SGST Act", igst: 0, cgst: 0, sgst: 0, cess: 0 },
            D_others: { desc: "(2) Others", igst: 0, cgst: 0, sgst: 0, cess: 0 }
        };

        // Section 5
        const s5 = {
            compExempt: { desc: "From a supplier under composition scheme, Exempt and Nil rated supply", inter: 0, intra: 0 },
            nonGST: { desc: "Non GST supply", inter: 0, intra: 0 }
        };

        // Section 3.2 Groups (by Place of Supply -> Type)
        // Structure: state -> { unreg: { taxable, igst }, comp: { taxable, igst }, uin: { taxable, igst } }
        const s3_2_groups = {};

        // --- Processing Sales (Outward Supplies) ---
        sales.forEach(sale => {
            const customer = sale.customerInformation || {};
            const pos = customer.placeOfSupply || userState;
            const isInter = this.isInterState(userState, pos);
            const isExport = sale.invoiceDetails?.invoiceType?.toLowerCase().includes('export') || pos?.toLowerCase() === 'outside india';

            // For 3.2 Unregistered vs Registered
            const gstin = customer.gstinPan ? customer.gstinPan.trim() : '';
            const isUnreg = !gstin || gstin.length < 15;

            (sale.items || []).forEach(item => {
                const taxVal = this.getNum(item.taxableValue);
                const igst = this.getNum(item.igst);
                const cgst = this.getNum(item.cgst);
                const sgst = this.getNum(item.sgst);
                const cess = this.getNum(item.cess);
                const totalTax = igst + cgst + sgst;

                if (isExport) {
                    // 3.1(b) Zero rated
                    s3_1.outwardZero.taxable += taxVal;
                    s3_1.outwardZero.igst += igst;
                    s3_1.outwardZero.cgst += cgst;
                    s3_1.outwardZero.sgst += sgst;
                    s3_1.outwardZero.cess += cess;
                } else if (totalTax === 0) {
                    // 3.1(c) Nil Rated / Exempted
                    s3_1.outwardOther.taxable += taxVal;
                    s3_1.outwardOther.igst += igst;
                    s3_1.outwardOther.cgst += cgst;
                    s3_1.outwardOther.sgst += sgst;
                    s3_1.outwardOther.cess += cess;
                } else {
                    // 3.1(a) Outward Taxable
                    s3_1.outwardTaxable.taxable += taxVal;
                    s3_1.outwardTaxable.igst += igst;
                    s3_1.outwardTaxable.cgst += cgst;
                    s3_1.outwardTaxable.sgst += sgst;
                    s3_1.outwardTaxable.cess += cess;

                    // Section 3.2: Of supplies in 3.1(a), inter-state supplies
                    if (isInter) {
                        if (!s3_2_groups[pos]) {
                            s3_2_groups[pos] = {
                                unreg: { taxable: 0, igst: 0 },
                                comp: { taxable: 0, igst: 0 },
                                uin: { taxable: 0, igst: 0 }
                            };
                        }

                        // Roughly assigning to Unregistered if no valid GSTIN
                        if (isUnreg) {
                            s3_2_groups[pos].unreg.taxable += taxVal;
                            s3_2_groups[pos].unreg.igst += igst;
                        }
                        // Composition checking is complex, mostly defaulting to Unreg for B2C if no flag exists.
                        // Assuming valid GSTIN is registered. (Not Composition/UIN by default unless specifically flagged)
                    }
                }
            });
        });

        // Credit Notes reduce Sales (3.1 Outward)
        creditNotes.forEach(cn => {
            const customer = cn.customerInformation || {};
            const pos = customer.placeOfSupply || userState;
            const isExport = cn.documentDetails?.documentType?.toLowerCase().includes('export') || pos?.toLowerCase() === 'outside india';

            (cn.items || []).forEach(item => {
                const taxVal = this.getNum(item.taxableValue);
                const igst = this.getNum(item.igst);
                const cgst = this.getNum(item.cgst);
                const sgst = this.getNum(item.sgst);
                const cess = this.getNum(item.cess);
                const totalTax = igst + cgst + sgst;

                if (isExport) {
                    s3_1.outwardZero.taxable -= taxVal;
                    s3_1.outwardZero.igst -= igst;
                    s3_1.outwardZero.cgst -= cgst;
                    s3_1.outwardZero.sgst -= sgst;
                    s3_1.outwardZero.cess -= cess;
                } else if (totalTax === 0) {
                    s3_1.outwardOther.taxable -= taxVal;
                } else {
                    s3_1.outwardTaxable.taxable -= taxVal;
                    s3_1.outwardTaxable.igst -= igst;
                    s3_1.outwardTaxable.cgst -= cgst;
                    s3_1.outwardTaxable.sgst -= sgst;
                    s3_1.outwardTaxable.cess -= cess;
                }
            });
        });

        // --- Processing Purchases (Inward Supplies / ITC) ---
        purchases.forEach(purchase => {
            const vendor = purchase.vendorInformation || {};
            const isRevCharge = purchase.invoiceDetails?.reverseCharge === true || vendor.reverseCharge === true;
            const isImport = vendor.placeOfSupply?.toLowerCase() === 'outside india' || purchase.invoiceDetails?.invoiceType === 'Import';
            const isInter = this.isInterState(userState, vendor.placeOfSupply || userState);

            (purchase.items || []).forEach(item => {
                const taxVal = this.getNum(item.taxableValue);
                const igst = this.getNum(item.igst);
                const cgst = this.getNum(item.cgst);
                const sgst = this.getNum(item.sgst);
                const cess = this.getNum(item.cess);
                const totalTax = igst + cgst + sgst;

                if (isRevCharge) {
                    // 3.1(d) Inward supplies liable to reverse charge
                    s3_1.inwardRev.taxable += taxVal;
                    s3_1.inwardRev.igst += igst;
                    s3_1.inwardRev.cgst += cgst;
                    s3_1.inwardRev.sgst += sgst;
                    s3_1.inwardRev.cess += cess;

                    // 4(A)(3) ITC available on Reverse Charge
                    s4.A_inwardRev.igst += igst;
                    s4.A_inwardRev.cgst += cgst;
                    s4.A_inwardRev.sgst += sgst;
                    s4.A_inwardRev.cess += cess;
                }
                else if (totalTax === 0) {
                    // Section 5: Values of exempt, nil-rated
                    if (isInter) s5.compExempt.inter += taxVal;
                    else s5.compExempt.intra += taxVal;
                }
                else if (isImport) {
                    // 4(A)(1) Import of Goods (Simplification: assuming goods)
                    s4.A_importGoods.igst += igst;
                    s4.A_importGoods.cess += cess;
                }
                else {
                    // 4(A)(5) All other ITC
                    s4.A_allOther.igst += igst;
                    s4.A_allOther.cgst += cgst;
                    s4.A_allOther.sgst += sgst;
                    s4.A_allOther.cess += cess;
                }
            });
        });

        // Debit Notes reduce Purchases (ITC)
        debitNotes.forEach(dn => {
            const vendor = dn.vendorInformation || {};
            const isRevCharge = dn.documentDetails?.reverseCharge === true || vendor.reverseCharge === true;

            (dn.items || []).forEach(item => {
                const taxVal = this.getNum(item.taxableValue);
                const igst = this.getNum(item.igst);
                const cgst = this.getNum(item.cgst);
                const sgst = this.getNum(item.sgst);
                const cess = this.getNum(item.cess);

                if (isRevCharge) {
                    s3_1.inwardRev.taxable -= taxVal;
                    s3_1.inwardRev.igst -= igst;
                    s3_1.inwardRev.cgst -= cgst;
                    s3_1.inwardRev.sgst -= sgst;
                    s3_1.inwardRev.cess -= cess;

                    s4.A_inwardRev.igst -= igst;
                    s4.A_inwardRev.cgst -= cgst;
                    s4.A_inwardRev.sgst -= sgst;
                    s4.A_inwardRev.cess -= cess;
                } else if (igst + cgst + sgst > 0) {
                    s4.A_allOther.igst -= igst;
                    s4.A_allOther.cgst -= cgst;
                    s4.A_allOther.sgst -= sgst;
                    s4.A_allOther.cess -= cess;
                }
            });
        });

        // --- Formatting the JSON Response Structure exactly like the UI expects ---

        // Section 3.1
        const section3_1 = [];
        let total3_1 = { desc: "Total", taxable: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 };
        Object.values(s3_1).forEach(row => {
            section3_1.push(row);
            total3_1.taxable += row.taxable;
            total3_1.igst += row.igst;
            total3_1.cgst += row.cgst;
            total3_1.sgst += row.sgst;
            total3_1.cess += row.cess;
        });
        section3_1.push(total3_1);

        // Section 4
        // Calc Net ITC (A - B)
        const netITC = {
            desc: "(C) Net ITO Available (A)-(B)",
            igst: (s4.A_importGoods.igst + s4.A_importServices.igst + s4.A_inwardRev.igst + s4.A_inwardISD.igst + s4.A_allOther.igst) - (s4.B_rule42.igst + s4.B_others.igst),
            cgst: (s4.A_importGoods.cgst + s4.A_importServices.cgst + s4.A_inwardRev.cgst + s4.A_inwardISD.cgst + s4.A_allOther.cgst) - (s4.B_rule42.cgst + s4.B_others.cgst),
            sgst: (s4.A_importGoods.sgst + s4.A_importServices.sgst + s4.A_inwardRev.sgst + s4.A_inwardISD.sgst + s4.A_allOther.sgst) - (s4.B_rule42.sgst + s4.B_others.sgst),
            cess: (s4.A_importGoods.cess + s4.A_importServices.cess + s4.A_inwardRev.cess + s4.A_inwardISD.cess + s4.A_allOther.cess) - (s4.B_rule42.cess + s4.B_others.cess),
        };

        const section4 = {
            A: [s4.A_importGoods, s4.A_importServices, s4.A_inwardRev, s4.A_inwardISD, s4.A_allOther],
            B: [s4.B_rule42, s4.B_others],
            C: [netITC],
            D: [s4.D_section175, s4.D_others]
        };

        // Section 5
        const section5 = [
            s5.compExempt,
            s5.nonGST,
            { desc: "Total", inter: s5.compExempt.inter + s5.nonGST.inter, intra: s5.compExempt.intra + s5.nonGST.intra }
        ];

        // Section 5.1
        const section5_1 = [
            { desc: "Interest", igst: 0, cgst: 0, sgst: 0, cess: 0 }
        ];

        // Section 3.2
        const section3_2 = [];
        let total3_2 = { pos: "Total", unregTaxable: 0, unregIgst: 0, compTaxable: 0, compIgst: 0, uinTaxable: 0, uinIgst: 0 };

        Object.keys(s3_2_groups).sort().forEach(pos => {
            const row = s3_2_groups[pos];
            if (row.unreg.taxable > 0 || row.comp.taxable > 0 || row.uin.taxable > 0) {
                const outRow = {
                    pos: pos,
                    unregTaxable: row.unreg.taxable,
                    unregIgst: row.unreg.igst,
                    compTaxable: row.comp.taxable,
                    compIgst: row.comp.igst,
                    uinTaxable: row.uin.taxable,
                    uinIgst: row.uin.igst
                };
                section3_2.push(outRow);
                total3_2.unregTaxable += outRow.unregTaxable;
                total3_2.unregIgst += outRow.unregIgst;
                total3_2.compTaxable += outRow.compTaxable;
                total3_2.compIgst += outRow.compIgst;
                total3_2.uinTaxable += outRow.uinTaxable;
                total3_2.uinIgst += outRow.uinIgst;
            }
        });
        if (section3_2.length > 0) {
            section3_2.push(total3_2);
        }

        return {
            section3_1,
            section4,
            section5,
            section5_1,
            section3_2
        };
    }

    /**
     * Entry method for standard search API
     */
    static async searchReport(userId, fromDate, toDate) {
        try {
            const data = await this.getGSTR3BData(userId, fromDate, toDate);
            return {
                success: true,
                data: data
            };
        } catch (error) {
            console.error("GSTR3BReportModel.searchReport Error:", error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Entry method for Report Action Export/Email logic
     */
    static async getReportActionData(filters = {}, options = {}, user) {
        try {
            const { fromDate, toDate } = filters;
            if (!fromDate || !toDate) {
                throw new Error('From Date and To Date are required for GSTR-3B Report');
            }

            const data = await this.getGSTR3BData(user._id, fromDate, toDate);

            return {
                success: true,
                data: {
                    records: [data],
                    columns: [],
                    summary: {},
                    gstr3bMode: true
                }
            };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

module.exports = GSTR3BReportModel;
