const mongoose = require('mongoose');
const PurchaseOrder = require('../Other-Document-Model/PurchaseOrder');
const Product = require('../Product-Service-Model/Product');

class PurchaseProductReportModel {
    /**
     * Generate product-wise purchase report (Based on Purchase Orders)
     */
    static async getPurchaseProductReport(filters = {}, options = {}) {
        try {
            const {
                userId,
                customerVendor,
                productGroup,
                products,
                invoiceNumber, // This serves as PO Number search
                staffId,
                fromDate,
                toDate,
                groupingOptions,
                advanceFilters
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'totalAmount',
                sortOrder = 'desc'
            } = options;

            const pipeline = [];

            // Stage 1: Match Order Level
            const matchStage = {
                userId: new mongoose.Types.ObjectId(userId)
            };

            // Date Range (Using purchaseOrderDetails.date)
            if (fromDate || toDate) {
                matchStage['purchaseOrderDetails.date'] = {};
                if (fromDate) matchStage['purchaseOrderDetails.date'].$gte = new Date(fromDate);
                if (toDate) {
                    const endOfDay = new Date(toDate);
                    endOfDay.setUTCHours(23, 59, 59, 999);
                    matchStage['purchaseOrderDetails.date'].$lte = endOfDay;
                }
            }

            // Vendor Filter
            if (customerVendor) {
                matchStage['vendorInformation.ms'] = { $regex: customerVendor, $options: 'i' };
            }

            // PO Number Filter (Using purchaseOrderDetails.poNumber)
            if (invoiceNumber) {
                matchStage['purchaseOrderDetails.poNumber'] = { $regex: invoiceNumber, $options: 'i' };
            }

            // Staff Filter
            if (staffId) {
                // Note: PurchaseOrder schema defines staff loosely, usually Object ID is expected for search
                matchStage.staff = new mongoose.Types.ObjectId(staffId);
            }

            // Apply Match
            pipeline.push({ $match: matchStage });

            // Stage 2: Unwind Items
            pipeline.push({ $unwind: "$items" });

            // Stage 3: Item Level Filtering
            const itemMatchStage = {};

            // Product Name Filter
            if (products && products.length > 0) {
                itemMatchStage['items.productName'] = { $in: Array.isArray(products) ? products : [products] };
            }

            // Product Group Logic
            if (productGroup && productGroup.length > 0) {
                const productsInGroups = await Product.find({
                    userId: new mongoose.Types.ObjectId(userId),
                    productGroup: { $in: Array.isArray(productGroup) ? productGroup : [productGroup] }
                }).select('name').lean();

                const productNames = productsInGroups.map(p => p.name);

                if (itemMatchStage['items.productName']) {
                    itemMatchStage['items.productName'].$in = itemMatchStage['items.productName'].$in.filter(p => productNames.includes(p));
                } else {
                    itemMatchStage['items.productName'] = { $in: productNames };
                }
            }

            if (Object.keys(itemMatchStage).length > 0) {
                pipeline.push({ $match: itemMatchStage });
            }

            // Stage 4: Advanced Filters
            if (advanceFilters && advanceFilters.length > 0) {
                const dynamicMatch = {};
                advanceFilters.forEach(filter => {
                    let field = filter.field;
                    // Ensure we don't map invalid top-level fields
                    if (!field.startsWith('items.') &&
                        !field.startsWith('vendorInformation.') &&
                        !field.startsWith('purchaseOrderDetails.') // updated prefix check
                    ) {
                        if (field === 'Qty') field = 'items.qty';
                        if (field === 'Amount') field = 'items.total';
                        if (field === 'Price') field = 'items.price';
                    }

                    const val = filter.value;
                    if (filter.operator === 'equals') dynamicMatch[field] = val;
                    if (filter.operator === 'contains') dynamicMatch[field] = { $regex: val, $options: 'i' };
                    if (filter.operator === 'greaterThan') dynamicMatch[field] = { $gt: Number(val) };
                    if (filter.operator === 'lessThan') dynamicMatch[field] = { $lt: Number(val) };
                });
                if (Object.keys(dynamicMatch).length > 0) {
                    pipeline.push({ $match: dynamicMatch });
                }
            }

            // Stage 5: Grouping
            if (groupingOptions === 'HSN') {
                pipeline.push({
                    $group: {
                        _id: '$items.hsnSac',
                        totalQuantity: { $sum: '$items.qty' },
                        totalAmount: { $sum: '$items.total' },
                        avgPrice: { $avg: '$items.price' },
                        count: { $sum: 1 }
                    }
                });
            } else {
                // Default: Product Name (Title)
                pipeline.push({
                    $group: {
                        _id: { name: '$items.productName' },
                        totalQuantity: { $sum: '$items.qty' },
                        totalAmount: { $sum: '$items.total' },
                        avgPrice: { $avg: '$items.price' },
                        count: { $sum: 1 },
                        vendors: { $addToSet: '$vendorInformation.ms' }
                    }
                });
            }

            // Stage 6: Sorting
            const sortStage = {};
            const sortFieldMap = {
                'totalAmount': 'totalAmount',
                'totalQuantity': 'totalQuantity',
                'productName': '_id.name'
            };
            const mappedSort = sortFieldMap[sortBy] || 'totalAmount';
            sortStage[mappedSort] = sortOrder === 'asc' ? 1 : -1;
            pipeline.push({ $sort: sortStage });

            // Stage 7: Pagination
            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: "total" }]
                }
            });

            // Execute on PurchaseOrder
            const result = await PurchaseOrder.aggregate(pipeline).allowDiskUse(true);
            const docs = result[0].docs || [];
            const total = result[0].totalCount[0] ? result[0].totalCount[0].total : 0;

            return {
                success: true,
                data: {
                    docs,
                    reports: docs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page)
                },
                message: 'Purchase product report generated successfully'
            };

        } catch (error) {
            console.error('Purchase Product Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            groupingOptions: ['Title', 'HSN'],
            columns: ['Product Name', 'Quantity', 'Amount', 'Avg Price', 'Vendor']
        };
    }
}

module.exports = PurchaseProductReportModel;
