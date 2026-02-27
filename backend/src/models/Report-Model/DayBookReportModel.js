const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const InwardPayment = require('../Payment-Model/InwardPayment');
const OutwardPayment = require('../Payment-Model/OutwardPayment');
const DailyExpense = require('../Expense-Income-Model/DailyExpense');
const OtherIncome = require('../Expense-Income-Model/OtherIncome');

class DayBookReportModel {

    // Helper to build date match
    static buildDateMatch(fromDate, toDate, dateField = 'date') {
        const match = {};
        if (fromDate) match.$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            match.$lte = end;
        }
        return { [dateField]: match };
    }

    static async getDayBookReport(filters = {}) {
        try {
            const userId = new mongoose.Types.ObjectId(filters.userId);
            const fromDate = filters.fromDate;
            const toDate = filters.toDate;
            const customerVendorName = filters.customerVendor;

            // Helper to build Customer array $or condition
            const buildCustomerMatch = (fieldName) => {
                if (!customerVendorName) return {};

                // If it's an array for multi-select
                if (Array.isArray(customerVendorName) && customerVendorName.length > 0) {
                    return { [fieldName]: { $in: customerVendorName.map(name => new RegExp(name, 'i')) } };
                } else if (typeof customerVendorName === 'string' && customerVendorName.trim() !== '') {
                    return { [fieldName]: { $regex: customerVendorName, $options: 'i' } };
                }
                return {};
            };

            // Allow bypassing filters if Show All is requested
            // But usually Date range always applies in Day Book (Daily view)
            // 'Show All Documents' typically means ignore party/staff filters, but respect date.

            const queries = [];

            // 1. Sales
            const salesQuery = { userId };
            if (fromDate || toDate) salesQuery['invoiceDetails.date'] = this.buildDateMatch(fromDate, toDate, 'invoiceDetails.date')['invoiceDetails.date'];
            if (!filters.showAllDocuments) {
                Object.assign(salesQuery, buildCustomerMatch('customerInformation.ms'));
                if (filters.staffId) {
                    salesQuery.staff = new mongoose.Types.ObjectId(filters.staffId);
                }
            }

            queries.push(
                SaleInvoice.find(salesQuery).populate('staff', 'fullName').lean().then(docs => docs.map(doc => ({
                    date: doc.invoiceDetails.date,
                    voucherType: 'Sale Invoice',
                    voucherNo: doc.invoiceDetails.invoiceNumber,
                    partyName: doc.customerInformation.ms,
                    amount: doc.totals.grandTotal,
                    paymentType: doc.paymentType,
                    type: 'Credit', // Sale is usually credit or income source
                    _id: doc._id
                })))
            );

            // 2. Purchase
            const purchaseQuery = { userId };
            if (fromDate || toDate) purchaseQuery['invoiceDetails.date'] = this.buildDateMatch(fromDate, toDate, 'invoiceDetails.date')['invoiceDetails.date'];
            if (!filters.showAllDocuments) {
                Object.assign(purchaseQuery, buildCustomerMatch('vendorInformation.ms'));
                // Assuming purchases might also have staff tracking, if not it just ignores if empty.
                if (filters.staffId && PurchaseInvoice.schema && PurchaseInvoice.schema.paths.staff) {
                    purchaseQuery.staff = new mongoose.Types.ObjectId(filters.staffId);
                }
            }

            queries.push(
                PurchaseInvoice.find(purchaseQuery).lean().then(docs => docs.map(doc => ({
                    date: doc.invoiceDetails.date,
                    voucherType: 'Purchase Invoice',
                    voucherNo: doc.invoiceDetails.invoiceNumber,
                    partyName: doc.vendorInformation.ms,
                    amount: doc.totals.grandTotal,
                    paymentType: doc.paymentType,
                    type: 'Debit', // Purchase is expense/debit
                    _id: doc._id
                })))
            );

            // 3. Inward Payments
            const inPayQuery = { userId };
            if (fromDate || toDate) Object.assign(inPayQuery, this.buildDateMatch(fromDate, toDate, 'paymentDate'));
            if (!filters.showAllDocuments) {
                Object.assign(inPayQuery, buildCustomerMatch('companyName'));
                if (filters.staffId && InwardPayment.schema && InwardPayment.schema.paths.staff) {
                    inPayQuery.staff = new mongoose.Types.ObjectId(filters.staffId);
                }
            }

            queries.push(
                InwardPayment.find(inPayQuery).lean().then(docs => docs.map(doc => ({
                    date: doc.paymentDate,
                    voucherType: 'Inward Payment',
                    voucherNo: doc.receiptNo,
                    partyName: doc.companyName,
                    amount: doc.amount,
                    paymentType: doc.paymentType,
                    type: 'Credit', // Money coming in
                    _id: doc._id
                })))
            );

            // 4. Outward Payments
            const outPayQuery = { userId };
            if (fromDate || toDate) Object.assign(outPayQuery, this.buildDateMatch(fromDate, toDate, 'paymentDate'));
            if (!filters.showAllDocuments) {
                Object.assign(outPayQuery, buildCustomerMatch('companyName'));
                if (filters.staffId && OutwardPayment.schema && OutwardPayment.schema.paths.staff) {
                    outPayQuery.staff = new mongoose.Types.ObjectId(filters.staffId);
                }
            }

            queries.push(
                OutwardPayment.find(outPayQuery).lean().then(docs => docs.map(doc => ({
                    date: doc.paymentDate,
                    voucherType: 'Outward Payment',
                    voucherNo: doc.paymentNo,
                    partyName: doc.companyName,
                    amount: doc.amount,
                    paymentType: doc.paymentType,
                    type: 'Debit', // Money going out
                    _id: doc._id
                })))
            );

            // 5. Daily Expenses
            const expenseQuery = { userId };
            if (fromDate || toDate) Object.assign(expenseQuery, this.buildDateMatch(fromDate, toDate, 'expenseDate'));

            // Staff Filter
            // Expense has 'staff' ref. If filters.staffId is present, we filter by it.
            if (filters.staffId && !filters.showAllDocuments) {
                expenseQuery.staff = new mongoose.Types.ObjectId(filters.staffId);
            }

            queries.push(
                DailyExpense.find(expenseQuery).populate('staff', 'fullName').populate('party', 'companyName').lean().then(docs => docs.map(doc => ({
                    date: doc.expenseDate,
                    voucherType: 'Expense',
                    voucherNo: doc.expenseNo,
                    partyName: doc.party ? doc.party.companyName : (doc.category || 'General'),
                    staffName: doc.staff ? doc.staff.fullName : null,
                    amount: doc.grandTotal,
                    paymentType: doc.paymentType,
                    type: 'Debit',
                    _id: doc._id
                })))
            );

            // 6. Other Income
            const incomeQuery = { userId };
            if (fromDate || toDate) Object.assign(incomeQuery, this.buildDateMatch(fromDate, toDate, 'incomeDate'));
            // Income has no staff or legacy party ref usually.

            queries.push(
                OtherIncome.find(incomeQuery).lean().then(docs => docs.map(doc => ({
                    date: doc.incomeDate,
                    voucherType: 'Other Income',
                    voucherNo: doc.incomeNo,
                    partyName: doc.category || 'General',
                    amount: doc.grandTotal,
                    paymentType: doc.paymentType,
                    type: 'Credit',
                    _id: doc._id
                })))
            );


            // Executive all
            const results = await Promise.all(queries);
            const flatData = results.flat();

            // JS Filter for things we couldn't filter in DB easily (like Expense Party Name if needed)
            let filteredData = flatData;

            if (!filters.showAllDocuments && customerVendorName) {
                if (Array.isArray(customerVendorName) && customerVendorName.length > 0) {
                    filteredData = filteredData.filter(d =>
                        customerVendorName.some(name => new RegExp(name, 'i').test(d.partyName))
                    );
                } else if (typeof customerVendorName === 'string' && customerVendorName.trim() !== '') {
                    const regex = new RegExp(customerVendorName, 'i');
                    filteredData = filteredData.filter(d => regex.test(d.partyName));
                }
            }

            // Sorting by Date Desc
            filteredData.sort((a, b) => new Date(b.date) - new Date(a.date));

            return {
                success: true,
                data: filteredData
            };

        } catch (error) {
            console.error('DayBookReportModel Error:', error);
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }

    /**
     * Get available filter fields and columns for report exports
     * @returns {Object} Available metadata
     */
    static getFilterMetadata() {
        return {
            columns: [
                { field: 'date', label: 'Date', type: 'date' },
                { field: 'voucherType', label: 'Voucher Type' },
                { field: 'voucherNo', label: 'Voucher No.' },
                { field: 'partyName', label: 'Party Name' },
                { field: 'amount', label: 'Amount', type: 'number' },
                { field: 'paymentType', label: 'Payment Type' },
                { field: 'type', label: 'Type' } // Debit/Credit
            ]
        };
    }
}

module.exports = DayBookReportModel;
