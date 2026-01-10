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

            // Allow bypassing filters if Show All is requested
            // But usually Date range always applies in Day Book (Daily view)
            // 'Show All Documents' typically means ignore party/staff filters, but respect date.

            const queries = [];

            // 1. Sales
            const salesQuery = { userId };
            if (fromDate || toDate) salesQuery['invoiceDetails.date'] = this.buildDateMatch(fromDate, toDate, 'invoiceDetails.date')['invoiceDetails.date'];
            if (!filters.showAllDocuments && customerVendorName) {
                salesQuery['customerInformation.ms'] = { $regex: customerVendorName, $options: 'i' };
            }
            // Filter by Staff if applicable? Sales schema has userId, but maybe not specific staff ref accessible easily for filtering without lookup.
            // But prompt says "Staff filter should match staff reference". SaleInvoice usually doesn't store 'staffId' directly in top level schema shown?
            // Checking schema: It has 'userId'. No 'staffId'. So ignoring staff filter for Sales unless implemented.

            queries.push(
                SaleInvoice.find(salesQuery).lean().then(docs => docs.map(doc => ({
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
            if (!filters.showAllDocuments && customerVendorName) {
                purchaseQuery['vendorInformation.ms'] = { $regex: customerVendorName, $options: 'i' };
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
            if (!filters.showAllDocuments && customerVendorName) {
                inPayQuery['companyName'] = { $regex: customerVendorName, $options: 'i' };
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
            if (!filters.showAllDocuments && customerVendorName) {
                outPayQuery['companyName'] = { $regex: customerVendorName, $options: 'i' };
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
            if (!filters.showAllDocuments) {
                // Expenses might not have "customerVendor", but have 'party' (Vendor). 
                // If filtering by party name, we'd need lookup. 
                // For simplicity, if simple text match isn't available, we skip strict party filter or assume user knows expense doesn't always have named party.
                // However, DailyExpense has 'party' ref. To filter by name, we'd need to search Vendors first?
                // Given the constraints, we'll try to support if simple. Expense doesn't have a direct 'partyName' string except populated.
                // We'll skip party filter for Expense for now unless 'showAllDocuments' is false? 
                // Wait, if showAllDocuments is false, we MUST filter. If we can't filter by name easily (ref ID), we might exclude unless we do lookup.
                // But prompt says "if user searches without selecting any filter...".
                // We will populate party and filter in JS for Expense/Staff logic if needed.
            }

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


            // Execute all
            const results = await Promise.all(queries);
            const flatData = results.flat();

            // JS Filter for things we couldn't filter in DB easily (like Expense Party Name if needed)
            let filteredData = flatData;

            if (!filters.showAllDocuments && customerVendorName) {
                const regex = new RegExp(customerVendorName, 'i');
                filteredData = filteredData.filter(d => regex.test(d.partyName));
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
}

module.exports = DayBookReportModel;
