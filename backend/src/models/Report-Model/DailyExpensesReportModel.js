const mongoose = require('mongoose');
const DailyExpense = require('../Expense-Income-Model/DailyExpense');

class DailyExpensesReportModel {
    static async getDailyExpensesReport(filters = {}, options = {}) {
        try {
            const pipeline = [];

            // 1. Match by userId (Always required)
            if (filters.userId) {
                pipeline.push({
                    $match: { userId: new mongoose.Types.ObjectId(filters.userId) }
                });
            }

            // 2. Lookup Staff for filtering by Staff Name
            pipeline.push({
                $lookup: {
                    from: 'staffs', // Assuming collection name is 'staffs' based on convention (plural of model 'Staff')
                    localField: 'staff',
                    foreignField: '_id',
                    as: 'staffDetails'
                }
            });
            pipeline.push({
                $unwind: { path: '$staffDetails', preserveNullAndEmptyArrays: true }
            });

            // 3. Date Range Filter (expenseDate)
            if (filters.fromDate || filters.toDate) {
                const dateMatch = {};
                if (filters.fromDate) dateMatch.$gte = new Date(filters.fromDate);
                if (filters.toDate) dateMatch.$lte = new Date(filters.toDate);
                pipeline.push({ $match: { expenseDate: dateMatch } });
            }

            // 4. Staff Name Filter
            if (filters.staffName) {
                pipeline.push({
                    $match: { 'staffDetails.name': new RegExp(filters.staffName, 'i') }
                });
            }

            // 5. Category Filter
            if (filters.category) {
                pipeline.push({
                    $match: { category: new RegExp(filters.category, 'i') }
                });
            }

            // 6. Title Filter (Search in items.name)
            if (filters.title) {
                pipeline.push({
                    $match: { 'items.name': new RegExp(filters.title, 'i') }
                });
            }

            // 7. Payment Type Filter
            if (filters.paymentType) {
                pipeline.push({
                    $match: { paymentType: new RegExp(filters.paymentType, 'i') } // RegExp allows case-insensitive 'cash' vs 'CASH'
                });
            }

            // 8. Advanced Filters
            if (filters.advancedFilters && Array.isArray(filters.advancedFilters)) {
                filters.advancedFilters.forEach(filter => {
                    if (filter.field && filter.operator && filter.value !== undefined) {
                        const matchCondition = {};
                        // Map operators to MongoDB operators
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

            // 9. Sorting
            if (options.sortBy) {
                pipeline.push({ $sort: options.sortBy });
            } else {
                pipeline.push({ $sort: { expenseDate: -1, createdAt: -1 } });
            }

            // 10. Projection (Selected Columns)
            // If columns are provided, we project them. Else return all.
            // We must ensure we keep the fields needed for the frontend list even if not explicitly asked, 
            // but usually reports stick to what is asked. However, I'll default to all if empty.
            // Add useful fields for display before projection
            const addFieldsStage = {
                $addFields: {
                    staffName: '$staffDetails.name',
                    expenseTitle: { $arrayElemAt: ['$items.name', 0] },
                    expenseAmount: '$grandTotal',
                    expenseCategory: '$category',
                    expenseType: '$paymentType'
                }
            };

            if (options.selectedColumns && options.selectedColumns.length > 0) {
                pipeline.push(addFieldsStage);
            } else {
                pipeline.push(addFieldsStage);
            }

            // Determine final projection
            let finalProjection = {};
            if (options.selectedColumns && options.selectedColumns.length > 0) {
                options.selectedColumns.forEach(col => {
                    finalProjection[col] = 1;
                });
            } else {
                finalProjection = {
                    expenseNo: 1,
                    expenseTitle: 1,
                    expenseAmount: 1,
                    expenseCategory: 1,
                    expenseDate: 1,
                    expenseType: 1,
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
                        // Apply specific projection to clean up unused data
                        { $project: finalProjection }
                    ],
                    summary: [
                        {
                            $group: {
                                _id: null,
                                totalExpenseAmount: { $sum: '$grandTotal' }
                            }
                        }
                    ]
                }
            });

            const result = await DailyExpense.aggregate(pipeline);

            const data = result[0].data;
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
            const summaryData = result[0].summary[0] ? result[0].summary[0] : { totalExpenseAmount: 0 };

            return {
                success: true,
                data: {
                    expenses: data,
                    summary: {
                        totalExpenseAmount: summaryData.totalExpenseAmount
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
            console.error('DailyExpensesReportModel Error:', error);
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
                { field: 'expenseNo', label: 'Expense No.' },
                { field: 'expenseTitle', label: 'Expense Title' },
                { field: 'expenseAmount', label: 'Expense Amount', type: 'number' },
                { field: 'expenseCategory', label: 'Expense Category' },
                { field: 'expenseDate', label: 'Expense Date', type: 'date' },
                { field: 'expenseType', label: 'Expense Type' },
                { field: 'staffName', label: 'Staff Name' }
            ]
        };
    }
}

module.exports = DailyExpensesReportModel;
