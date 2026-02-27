const mongoose = require('mongoose');
const OtherIncome = require('../Expense-Income-Model/OtherIncome');

class OtherIncomeReportModel {
    static async getOtherIncomeReport(filters = {}, options = {}) {
        try {
            const pipeline = [];

            // 1. Match by userId (Always required)
            if (filters.userId) {
                pipeline.push({
                    $match: { userId: new mongoose.Types.ObjectId(filters.userId) }
                });
            }

            // 1.5 Lookup Staff for Staff Name functionality
            pipeline.push({
                $lookup: {
                    from: 'staffs',
                    localField: 'staff',
                    foreignField: '_id',
                    as: 'staffDetails'
                }
            });
            pipeline.push({
                $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true }
            });

            // 2. Date Range Filter (incomeDate)
            if (filters.fromDate || filters.toDate) {
                const dateMatch = {};
                if (filters.fromDate) dateMatch.$gte = new Date(filters.fromDate);
                if (filters.toDate) dateMatch.$lte = new Date(filters.toDate);
                pipeline.push({ $match: { incomeDate: dateMatch } });
            }

            // 3. Category Filter
            if (filters.category) {
                pipeline.push({
                    $match: { category: new RegExp(filters.category, 'i') }
                });
            }

            // 4. Title Filter (Search in items.incomeName as per schema)
            if (filters.title) {
                pipeline.push({
                    $match: { 'items.incomeName': new RegExp(filters.title, 'i') }
                });
            }

            // 5. Payment Type Filter
            if (filters.paymentType) {
                pipeline.push({
                    $match: { paymentType: new RegExp(filters.paymentType, 'i') }
                });
            }

            // 6. Staff Name Filter
            if (filters.staffName) {
                pipeline.push({
                    $match: { 'staffDetails.name': new RegExp(filters.staffName, 'i') }
                });
            }

            // 7. Advanced Filters
            if (filters.advancedFilters && Array.isArray(filters.advancedFilters)) {
                filters.advancedFilters.forEach(filter => {
                    if (filter.field && filter.operator && filter.value !== undefined) {
                        const matchCondition = {};
                        const operatorMap = {
                            'equals': '$eq',
                            'notEquals': '$ne',
                            'greaterThan': '$gt',
                            'lessThan': '$lt',
                            'greaterThanOrEqual': '$gte',
                            'lessThanOrEqual': '$lte',
                            'contains': '$regex'
                        };

                        const op = operatorMap[filter.operator];
                        if (op) {
                            if (op === '$regex') {
                                matchCondition[filter.field] = new RegExp(filter.value, 'i');
                            } else {
                                matchCondition[filter.field] = { [op]: filter.value };
                            }
                            pipeline.push({ $match: matchCondition });
                        }
                    }
                });
            }

            // 8. Sorting
            if (options.sortBy) {
                pipeline.push({ $sort: options.sortBy });
            } else {
                pipeline.push({ $sort: { incomeDate: -1, createdAt: -1 } });
            }

            // 9. Projection (Selected Columns)
            const addFieldsStage = {
                $addFields: {
                    otherIncomeNo: '$incomeNo',
                    otherIncomeTitle: { $arrayElemAt: ['$items.incomeName', 0] },
                    otherIncomeAmount: '$grandTotal',
                    otherIncomeCategory: '$category',
                    otherIncomeDate: '$incomeDate',
                    otherIncomeType: '$paymentType',
                    staffName: '$staffDetails.name'
                }
            };

            pipeline.push(addFieldsStage);

            // Determine final projection
            let finalProjection = {};
            if (options.selectedColumns && options.selectedColumns.length > 0) {
                options.selectedColumns.forEach(col => {
                    finalProjection[col] = 1;
                });
            } else {
                finalProjection = {
                    otherIncomeNo: 1,
                    otherIncomeTitle: 1,
                    otherIncomeAmount: 1,
                    otherIncomeCategory: 1,
                    otherIncomeDate: 1,
                    otherIncomeType: 1,
                    staffName: 1
                };
            }

            // Pagination
            const page = options.page ? parseInt(options.page) : 1;
            const limit = options.limit ? parseInt(options.limit) : 10;
            const skip = (page - 1) * limit;

            pipeline.push({
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $skip: skip },
                        { $limit: limit },
                        { $project: finalProjection }
                    ],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalOtherIncomeAmount: { $sum: '$grandTotal' }
                            }
                        }
                    ]
                }
            });

            const result = await OtherIncome.aggregate(pipeline);

            const data = result[0].data;
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
            const summaryData = result[0].summary[0] ? result[0].summary[0] : { totalOtherIncomeAmount: 0 };

            return {
                success: true,
                data: {
                    incomes: data,
                    summary: {
                        totalOtherIncomeAmount: summaryData.totalOtherIncomeAmount
                    },
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

        } catch (error) {
            console.error('OtherIncomeReportModel Error:', error);
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
                { field: 'otherIncomeNo', label: 'Other Income No.' },
                { field: 'otherIncomeTitle', label: 'Other Income Title' },
                { field: 'otherIncomeAmount', label: 'Other Income Amount', type: 'number' },
                { field: 'otherIncomeCategory', label: 'Other Income Category' },
                { field: 'otherIncomeDate', label: 'Other Income Date', type: 'date' },
                { field: 'otherIncomeType', label: 'Other Income Type' },
                { field: 'staffName', label: 'Staff Name' }
            ]
        };
    }
}

module.exports = OtherIncomeReportModel;
