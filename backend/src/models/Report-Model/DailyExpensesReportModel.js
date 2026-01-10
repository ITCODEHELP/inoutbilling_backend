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
            if (options.selectedColumns && options.selectedColumns.length > 0) {
                const projection = {};
                options.selectedColumns.forEach(col => {
                    projection[col] = 1;
                });

                // Ensure critical fields are always there if needed (like _id), but if user wants export, exact columns are better.
                // However, usually Mongoose returns _id. Let's stick to what allows pagination.
                // If the user selects specific columns, we project them.
                // We'll also flatten `staff.name` into `staffName` if needed or keep structure.
                // For simplicity, let's keep the document structure but only include root fields requested.
                // If a requested field is nested (e.g. 'staffDetails.name'), handle it.

                // Actually, let's enrich the final output with useful lookups before projection

                // Add useful fields for display before projection
                pipeline.push({
                    $addFields: {
                        staffName: '$staffDetails.name'
                    }
                });

                // Apply projection
                // pipeline.push({ $project: projection }); // Moving this after pagination to allow filtering on all fields
            } else {
                pipeline.push({
                    $addFields: {
                        staffName: '$staffDetails.name'
                    }
                });
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
                        // Clean up lookup artifacts if necessary, or just return enriched data
                        { $project: { staffDetails: 0 } } // Remove the full staff object to keep payload light, we have staffName
                    ]
                }
            });

            const result = await DailyExpense.aggregate(pipeline);

            const data = result[0].data;
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

            return {
                success: true,
                data: {
                    expenses: data,
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
}

module.exports = DailyExpensesReportModel;
