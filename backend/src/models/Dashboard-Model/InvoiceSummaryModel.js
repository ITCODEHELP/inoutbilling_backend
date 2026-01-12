const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');
const DailyExpense = require('../Expense-Income-Model/DailyExpense');
const OtherIncome = require('../Expense-Income-Model/OtherIncome');

class InvoiceSummaryModel {

    /* ----------------------------------
       COUNT SUMMARY
    ---------------------------------- */
    static async getCountSummary(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const baseMatch = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (branchId) {
            baseMatch.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const buildMatchWithDate = (dateField) => {
            const match = { ...baseMatch };

            if (fromDate || toDate) {
                match[dateField] = {};
                if (fromDate) match[dateField].$gte = new Date(fromDate);
                if (toDate) match[dateField].$lte = new Date(toDate);
            }

            return match;
        };

        const [
            saleCount,
            purchaseCount,
            expenseCount,
            incomeCount
        ] = await Promise.all([
            SaleInvoice.countDocuments(buildMatchWithDate('invoiceDetails.date')),
            PurchaseInvoice.countDocuments(buildMatchWithDate('invoiceDetails.date')),
            DailyExpense.countDocuments(buildMatchWithDate('expenseDate')),
            OtherIncome.countDocuments(buildMatchWithDate('incomeDate'))
        ]);

        return {
            saleCount,
            purchaseCount,
            expenseCount,
            incomeCount
        };
    }

    /* ----------------------------------
       AMOUNT SUMMARY (FIXED)
    ---------------------------------- */
    static async getAmountSummary(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const baseMatch = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (branchId) {
            baseMatch.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const buildMatchWithDate = (dateField) => {
            const match = { ...baseMatch };

            if (fromDate || toDate) {
                match[dateField] = {};
                if (fromDate) match[dateField].$gte = new Date(fromDate);
                if (toDate) match[dateField].$lte = new Date(toDate);
            }

            return match;
        };

        const aggregateAmount = async (Model, dateField, amountField) => {
            const result = await Model.aggregate([
                { $match: buildMatchWithDate(dateField) },
                {
                    $group: {
                        _id: null,
                        total: {
                            $sum: { $ifNull: [`$${amountField}`, 0] }
                        }
                    }
                }
            ]);

            return result.length ? result[0].total : 0;
        };

        const [
            totalSales,
            totalPurchases,
            totalExpenses,
            totalIncome
        ] = await Promise.all([
            aggregateAmount(SaleInvoice, 'invoiceDetails.date', 'totals.grandTotal'),
            aggregateAmount(PurchaseInvoice, 'invoiceDetails.date', 'totals.grandTotal'),
            aggregateAmount(DailyExpense, 'expenseDate', 'grandTotal'),
            aggregateAmount(OtherIncome, 'incomeDate', 'grandTotal')
        ]);

        return {
            totalSales,
            totalPurchases,
            totalExpenses,
            totalIncome
        };
    }
}

module.exports = InvoiceSummaryModel;
