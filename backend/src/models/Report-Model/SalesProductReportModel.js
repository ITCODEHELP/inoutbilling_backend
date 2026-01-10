const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');

class SalesProductReportModel {
    static async getSalesProductReport(filters = {}) {
        try {
            const pipeline = [];
            
            // Match by userId
            if (filters.userId) {
                pipeline.push({
                    $match: { userId: new mongoose.Types.ObjectId(filters.userId) }
                });
            }

            // Date range filter
            if (filters.fromDate || filters.toDate) {
                const dateMatch = {};
                if (filters.fromDate) dateMatch.$gte = new Date(filters.fromDate);
                if (filters.toDate) dateMatch.$lte = new Date(filters.toDate);
                pipeline.push({ $match: { 'invoiceDetails.date': dateMatch } });
            }

            // Customer/Vendor filter
            if (filters.customerVendor) {
                pipeline.push({
                    $match: { 'customerInformation.ms': new RegExp(filters.customerVendor, 'i') }
                });
            }

            // Invoice number filter
            if (filters.invoiceNumber) {
                pipeline.push({
                    $match: { 'invoiceDetails.invoiceNumber': new RegExp(filters.invoiceNumber, 'i') }
                });
            }

            // Invoice series filter
            if (filters.invoiceSeries) {
                pipeline.push({
                    $match: { 'invoiceDetails.invoicePrefix': new RegExp(filters.invoiceSeries, 'i') }
                });
            }

            // Unwind items
            pipeline.push({ $unwind: '$items' });

            // Products filter
            if (filters.products && filters.products.length > 0) {
                pipeline.push({
                    $match: { 'items.productName': { $in: filters.products } }
                });
            }

            // Advanced filters (skip staffName and productGroup as they don't exist in schema)
            if (filters.advanceFilters && Array.isArray(filters.advanceFilters)) {
                filters.advanceFilters.forEach(filter => {
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
                        
                        const operator = operatorMap[filter.operator];
                        if (operator) {
                            if (operator === '$regex') {
                                matchCondition[filter.field] = new RegExp(filter.value, 'i');
                            } else {
                                matchCondition[filter.field] = { [operator]: filter.value };
                            }
                            pipeline.push({ $match: matchCondition });
                        }
                    }
                });
            }

            // Group by product
            const groupBy = filters.groupProductBy || 'Title with GST%';
            let groupId = {};
            
            switch(groupBy) {
                case 'Title with GST%':
                    groupId = {
                        productName: '$items.productName',
                        gstPercentage: {
                            $cond: {
                                if: { $gt: ['$items.totalTax', 0] },
                                then: { 
                                    $multiply: [
                                        { $divide: ['$items.totalTax', '$items.total'] },
                                        100
                                    ]
                                },
                                else: 0
                            }
                        }
                    };
                    break;
                case 'HSN':
                    groupId = { hsnSac: '$items.hsnSac' };
                    break;
                case 'HSN with GST%':
                    groupId = {
                        hsnSac: '$items.hsnSac',
                        gstPercentage: {
                            $cond: {
                                if: { $gt: ['$items.totalTax', 0] },
                                then: { 
                                    $multiply: [
                                        { $divide: ['$items.totalTax', '$items.total'] },
                                        100
                                    ]
                                },
                                else: 0
                            }
                        }
                    };
                    break;
                case 'Title with HSN with GST%':
                    groupId = {
                        productName: '$items.productName',
                        hsnSac: '$items.hsnSac',
                        gstPercentage: {
                            $cond: {
                                if: { $gt: ['$items.totalTax', 0] },
                                then: { 
                                    $multiply: [
                                        { $divide: ['$items.totalTax', '$items.total'] },
                                        100
                                    ]
                                },
                                else: 0
                            }
                        }
                    };
                    break;
                default:
                    groupId = { productName: '$items.productName' };
            }

            pipeline.push({
                $group: {
                    _id: groupId,
                    totalQuantity: { $sum: '$items.qty' },
                    totalAmount: { $sum: '$items.total' },
                    totalTax: { $sum: '$items.totalTax' },
                    avgPrice: { $avg: '$items.price' },
                    invoiceCount: { $sum: 1 }
                }
            });

            // Project final result
            const projectFields = {
                _id: 0,
                productName: '$_id.productName',
                hsnSac: '$_id.hsnSac',
                gstPercentage: '$_id.gstPercentage',
                totalQuantity: 1,
                totalAmount: 1,
                totalTax: 1,
                avgPrice: { $round: ['$avgPrice', 2] },
                invoiceCount: 1
            };

            if (filters.showPrimaryUOM) {
                projectFields.primaryUOM = '$items.uom';
            }

            pipeline.push({ $project: projectFields });

            // Sort
            pipeline.push({ $sort: { totalAmount: -1 } });

            // Pagination
            if (filters.limit) {
                pipeline.push({ $limit: parseInt(filters.limit) });
            }

            const result = await SaleInvoice.aggregate(pipeline);
            
            return {
                success: true,
                data: result,
                count: result.length
            };

        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }

    static async getFilterMetadata() {
        return {
            success: true,
            data: {
                groupingOptions: [
                    'Title with GST%',
                    'HSN',
                    'HSN with GST%',
                    'Title with HSN with GST%'
                ],
                operators: [
                    'equals',
                    'notEquals',
                    'greaterThan',
                    'lessThan',
                    'greaterThanOrEqual',
                    'lessThanOrEqual',
                    'contains'
                ],
                availableFields: [
                    'items.productName',
                    'items.total',
                    'items.qty',
                    'items.price',
                    'items.totalTax',
                    'customerInformation.ms',
                    'invoiceDetails.invoiceNumber',
                    'invoiceDetails.date'
                ]
            }
        };
    }
}

module.exports = SalesProductReportModel;
