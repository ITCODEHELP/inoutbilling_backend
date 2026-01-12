const mongoose = require('mongoose');
const DailyExpense = require('../Expense-Income-Model/DailyExpense');
const OtherIncome = require('../Expense-Income-Model/OtherIncome');

class ExpenseIncomeModel {
    /**
     * Get Expense and Income Summary for Dashboard
     * @param {Object} filters - userId, fromDate, toDate, branchId
     */
    static async getSummary(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const baseMatch = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (branchId) {
            baseMatch['branchId'] = new mongoose.Types.ObjectId(branchId);
        }

        const expenseMatch = { ...baseMatch };
        if (fromDate || toDate) {
            expenseMatch.expenseDate = {};
            if (fromDate) expenseMatch.expenseDate.$gte = new Date(fromDate);
            if (toDate) expenseMatch.expenseDate.$lte = new Date(toDate);
        }

        const incomeMatch = { ...baseMatch };
        if (fromDate || toDate) {
            incomeMatch.incomeDate = {};
            if (fromDate) incomeMatch.incomeDate.$gte = new Date(fromDate);
            if (toDate) incomeMatch.incomeDate.$lte = new Date(toDate);
        }

        // Aggregate Expenses
        const expenseAgg = [
            { $match: expenseMatch },
            {
                $group: {
                    _id: null,
                    totalExpense: { $sum: '$grandTotal' }
                }
            }
        ];

        // Aggregate Other Incomes
        const incomeAgg = [
            { $match: incomeMatch },
            {
                $group: {
                    _id: null,
                    totalIncome: { $sum: '$grandTotal' }
                }
            }
        ];

        const [expenseResult, incomeResult] = await Promise.all([
            DailyExpense.aggregate(expenseAgg),
            OtherIncome.aggregate(incomeAgg)
        ]);

        const totalExpense = expenseResult[0] ? expenseResult[0].totalExpense : 0;
        const totalIncome = incomeResult[0] ? incomeResult[0].totalIncome : 0;

        return {
            totalExpense: Math.round(totalExpense * 100) / 100,
            totalIncome: Math.round(totalIncome * 100) / 100,
            netProfitLoss: Math.round((totalIncome - totalExpense) * 100) / 100
        };
    }
}

module.exports = ExpenseIncomeModel;
