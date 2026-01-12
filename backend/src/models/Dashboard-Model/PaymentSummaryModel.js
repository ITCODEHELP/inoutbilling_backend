const mongoose = require('mongoose');
const InwardPayment = require('../Payment-Model/InwardPayment');
const OutwardPayment = require('../Payment-Model/OutwardPayment');

class PaymentSummaryModel {
    /**
     * Get Payment Summary
     */
    static async getPaymentSummary(filters) {
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

        const aggregatePayment = async (Model, dateField) => {
            const result = await Model.aggregate([
                { $match: buildMatchWithDate(dateField) },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $ifNull: ['$amount', 0] } }
                    }
                }
            ]);
            return result.length ? result[0].total : 0;
        };

        const [totalInwardPayment, totalOutwardPayment] = await Promise.all([
            aggregatePayment(InwardPayment, 'paymentDate'),
            aggregatePayment(OutwardPayment, 'paymentDate')
        ]);

        return {
            totalInwardPayment,
            totalOutwardPayment
        };
    }
}

module.exports = PaymentSummaryModel;
