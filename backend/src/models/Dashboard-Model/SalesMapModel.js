const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class SalesMapModel {
    /**
     * Get Sales by Region (Place of Supply)
     */
    static async getRegionalSales(filters) {
        const { userId, fromDate, toDate, branchId } = filters;

        const match = {
            userId: new mongoose.Types.ObjectId(userId)
        };

        if (fromDate || toDate) {
            match['invoiceDetails.date'] = {};
            if (fromDate) match['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) match['invoiceDetails.date'].$lte = new Date(toDate);
        }

        if (branchId) {
            match['branchId'] = new mongoose.Types.ObjectId(branchId);
        }

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: '$customerInformation.placeOfSupply',
                    totalSales: { $sum: '$totals.grandTotal' },
                    invoiceCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    state: '$_id',
                    totalSales: { $round: ['$totalSales', 2] },
                    invoiceCount: 1
                }
            },
            { $sort: { totalSales: -1 } }
        ];

        return await SaleInvoice.aggregate(aggregation);
    }
}

module.exports = SalesMapModel;
