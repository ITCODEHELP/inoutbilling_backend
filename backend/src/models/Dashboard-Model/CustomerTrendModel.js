const mongoose = require('mongoose');
const Customer = require('../Customer-Vendor-Model/Customer');

class CustomerTrendModel {
    /**
     * Get New vs Existing Customers Trend
     */
    static async getTrend(filters) {
        const { userId, fromDate, toDate } = filters;

        const start = fromDate ? new Date(fromDate) : new Date(0);
        const end = toDate ? new Date(toDate) : new Date();

        const match = {
            userId: new mongoose.Types.ObjectId(userId),
            createdAt: { $lte: end }
        };

        const aggregation = [
            { $match: match },
            {
                $group: {
                    _id: null,
                    totalCustomers: { $sum: 1 },
                    newCustomers: {
                        $sum: {
                            $cond: [{ $gte: ['$createdAt', start] }, 1, 0]
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalCustomers: 1,
                    newCustomers: 1,
                    existingCustomers: { $subtract: ['$totalCustomers', '$newCustomers'] }
                }
            }
        ];

        const result = await Customer.aggregate(aggregation);

        return result[0] || {
            totalCustomers: 0,
            newCustomers: 0,
            existingCustomers: 0
        };
    }
}

module.exports = CustomerTrendModel;
