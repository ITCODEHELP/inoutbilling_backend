const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class DueInvoicesModel {
    /**
     * Get Due and Overdue Invoices
     */
    static async getDueInvoices(filters) {
        const { userId, fromDate, toDate, branchId, limit = 10 } = filters;
        const today = new Date();

        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (fromDate || toDate) {
            match['invoiceDetails.date'] = {};
            if (fromDate) match['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) match['invoiceDetails.date'].$lte = new Date(toDate);
        }

        if (branchId) {
            match.branchId = new mongoose.Types.ObjectId(branchId);
        }

        const aggregation = [
            { $match: match },
            {
                $project: {
                    _id: 1,
                    invoiceNumber: '$invoiceDetails.invoiceNumber',
                    customerName: '$customerInformation.ms',
                    amount: '$totals.grandTotal',
                    dueDate: 1,
                    isOverdue: { $lt: ['$dueDate', today] },
                    daysOverdue: {
                        $cond: {
                            if: { $lt: ['$dueDate', today] },
                            then: { $divide: [{ $subtract: [today, '$dueDate'] }, 1000 * 60 * 60 * 24] },
                            else: 0
                        }
                    }
                }
            },
            { $sort: { dueDate: 1 } },
            { $limit: parseInt(limit) }
        ];

        return await SaleInvoice.aggregate(aggregation);
    }
}

module.exports = DueInvoicesModel;
