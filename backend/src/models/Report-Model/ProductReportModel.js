const mongoose = require('mongoose');
const Product = require('../Product-Service-Model/Product');

class ProductReportModel {
    static async getProductReport(filters = {}, options = {}) {
        try {
            const pipeline = [];

            // 1. Match by userId (Always required)
            if (filters.userId) {
                pipeline.push({
                    $match: { userId: new mongoose.Types.ObjectId(filters.userId) }
                });
            }

            // 2. Date Range Filter (createdAt)
            if (filters.fromDate || filters.toDate) {
                const dateMatch = {};
                if (filters.fromDate) dateMatch.$gte = new Date(filters.fromDate);
                if (filters.toDate) dateMatch.$lte = new Date(filters.toDate);
                pipeline.push({ $match: { createdAt: dateMatch } });
            }

            // 3. Product Name Filter
            if (filters.productName) {
                pipeline.push({
                    $match: { name: new RegExp(filters.productName, 'i') }
                });
            }

            // 4. Product Group Filter
            if (filters.productGroup) {
                pipeline.push({
                    $match: { productGroup: new RegExp(filters.productGroup, 'i') }
                });
            }

            // 5. Show Stock Adjusted Only
            // Assuming "Stock Adjusted" implies products where stock management is enabled
            if (filters.showStockAdjustedOnly) {
                pipeline.push({
                    $match: { manageStock: true }
                });
            }

            // 6. Group Record by Product
            // In a flat Product table, this likely implies sorting by Product Name for better readability
            // or if it was a transaction table it would group. Here we will ensure specific sort order.
            if (filters.groupRecordByProduct) {
                pipeline.push({ $sort: { name: 1 } });
            } else {
                pipeline.push({ $sort: { createdAt: -1 } });
            }

            // Pagination features
            const page = options.page ? parseInt(options.page) : 1;
            const limit = options.limit ? parseInt(options.limit) : 10;
            const skip = (page - 1) * limit;

            // Facet for total count and data
            pipeline.push({
                $facet: {
                    metadata: [{ $count: "total" }],
                    data: [
                        { $skip: skip },
                        { $limit: limit }
                    ]
                }
            });

            const result = await Product.aggregate(pipeline);

            const data = result[0].data;
            const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;

            return {
                success: true,
                data: {
                    products: data,
                    pagination: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit)
                    }
                }
            };

        } catch (error) {
            console.error('ProductReportModel Error:', error);
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }
}

module.exports = ProductReportModel;
