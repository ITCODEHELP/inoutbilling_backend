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

            // 6. Staff Name Filter (Note: OtherIncome schema doesn't seem to have valid staff ref, 
            // but keeping logic placeholder or ignoring if not present to avoid crash. 
            // If user explicitly asks, we might need to check if it's there. 
            // For now, if provided and not in schema, it would return empty results if we strictly match.)
            // Logic: The schema provided implies NO staff field.

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
            // Default projection or specific columns
            if (options.selectedColumns && options.selectedColumns.length > 0) {
                // If user wants specific columns, we could use $project.
                // However, often better to return full document or let frontend handle.
                // But for optimization/export, $project is good.
                // pipeline.push({ $project: ... });
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
                        { $limit: limit }
                    ]
                }
            });

            const result = await OtherIncome.aggregate(pipeline);

            const data = result[0].data;
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

            return {
                success: true,
                data: {
                    incomes: data,
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
}

module.exports = OtherIncomeReportModel;
