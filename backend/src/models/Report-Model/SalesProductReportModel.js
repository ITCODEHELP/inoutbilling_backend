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
                const customersArr = typeof filters.customerVendor === 'string'
                    ? filters.customerVendor.split(',').map(c => c.trim()).filter(Boolean)
                    : [filters.customerVendor];

                if (customersArr.length > 0) {
                    pipeline.push({
                        $match: { 'customerInformation.ms': new RegExp(customersArr.join('|'), 'i') }
                    });
                }
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

            // Add totalTax field for aggregation
            pipeline.push({
                $addFields: {
                    'items.totalTax': {
                        $add: [
                            { $ifNull: ['$items.igst', 0] },
                            { $ifNull: ['$items.cgst', 0] },
                            { $ifNull: ['$items.sgst', 0] }
                        ]
                    }
                }
            });

            // Group by product
            const groupBy = filters.groupProductBy || 'Title with GST%';
            let groupId = {};

            switch (groupBy) {
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
                case 'Product Group':
                    groupId = { productGroup: '$items.productGroup' };
                    break;
                default:
                    groupId = { productName: '$items.productName' };
            }

            pipeline.push({
                $group: {
                    _id: groupId,
                    totalQuantity: { $sum: '$items.qty' },
                    totalAmount: { $sum: '$items.total' },
                    totalTaxableAmount: { $sum: { $ifNull: ['$items.taxableValue', 0] } },
                    totalCGST: { $sum: { $ifNull: ['$items.cgst', 0] } },
                    totalSGST: { $sum: { $ifNull: ['$items.sgst', 0] } },
                    totalIGST: { $sum: { $ifNull: ['$items.igst', 0] } },
                    totalTax: { $sum: '$items.totalTax' },
                    avgPrice: { $avg: '$items.price' },
                    primaryUOM: { $first: '$items.uom' },
                    invoiceCount: { $sum: 1 }
                }
            });

            // Project final result
            const projectFields = {
                _id: 0,
                productName: { $ifNull: ['$_id.productName', null] },
                hsnSac: { $ifNull: ['$_id.hsnSac', null] },
                productGroup: { $ifNull: ['$_id.productGroup', null] },
                gstPercentage: { $ifNull: ['$_id.gstPercentage', null] },
                totalQuantity: 1,
                totalAmount: 1,
                totalTaxableAmount: 1,
                totalCGST: { $round: ['$totalCGST', 2] },
                totalSGST: { $round: ['$totalSGST', 2] },
                totalIGST: { $round: ['$totalIGST', 2] },
                totalTax: { $round: ['$totalTax', 2] },
                avgPrice: { $round: ['$avgPrice', 2] },
                primaryUOM: 1,
                invoiceCount: 1
            };

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

    static async getFilterMetadata(userId) {
        try {
            const [customers, products, productGroups, invoicePrefixes] = await Promise.all([
                SaleInvoice.distinct('customerInformation.ms', { userId }),
                SaleInvoice.distinct('items.productName', { userId }),
                SaleInvoice.distinct('items.productGroup', { userId }),
                SaleInvoice.distinct('invoiceDetails.invoicePrefix', { userId })
            ]);

            return {
                success: true,
                data: {
                    groupingOptions: [
                        'Title with GST%',
                        'HSN',
                        'HSN with GST%',
                        'Title with HSN with GST%',
                        'Product Group'
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
                    ],
                    dynamicValues: {
                        customers: customers.sort(),
                        products: products.sort(),
                        productGroups: productGroups.sort(),
                        invoicePrefixes: invoicePrefixes.sort()
                    }
                }
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }
}

module.exports = SalesProductReportModel;
