const mongoose = require('mongoose');
const SaleInvoice = require('../Sales-Invoice-Model/SaleInvoice');
const PurchaseInvoice = require('../Purchase-Invoice-Model/PurchaseInvoice');

class CompanyLedgerReportModel {

    static async getCompanyLedgerReport(filters = {}, options = {}) {
        try {
            const {
                customerVendor,
                fromDate,
                toDate,
                staffId,
                staffName,
                gstNo,
                showAmountAsPerInvoice,
                groupRecordByCustomer,
                showItemDetail,
                selectedColumns,
                userId
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'date',
                sortOrder = 'desc'
            } = options;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const pipeline = [];

            /* ---------------- DATE FILTER ---------------- */
            const dateFilter = {};
            if (fromDate) dateFilter.$gte = new Date(fromDate);
            if (toDate) {
                const eod = new Date(toDate);
                eod.setUTCHours(23, 59, 59, 999);
                dateFilter.$lte = eod;
            }

            /* ---------------- SALE MATCH ---------------- */
            const saleMatch = {
                userId: new mongoose.Types.ObjectId(userId)
            };

            if (Object.keys(dateFilter).length > 0) {
                saleMatch['invoiceDetails.date'] = dateFilter;
            }

            pipeline.push({ $match: saleMatch });

            /* ---------------- SALE NORMALIZATION ---------------- */
            pipeline.push({
                $project: {
                    type: { $literal: 'Sale' },
                    date: '$invoiceDetails.date',
                    invoiceNumber: '$invoiceDetails.invoiceNumber',
                    entityName: '$customerInformation.ms',
                    gstNo: '$customerInformation.gstinPan',
                    grandTotal: '$totals.grandTotal',
                    items: 1,
                    staff: 1,
                    totals: 1,
                    invoiceDetails: 1
                }
            });

            /* ---------------- PURCHASE MATCH (FIXED) ---------------- */
            const purchaseMatch = {
                userId: new mongoose.Types.ObjectId(userId)
            };

            if (Object.keys(dateFilter).length > 0) {
                purchaseMatch['invoiceDetails.date'] = dateFilter;
            }

            /* ---------------- UNION PURCHASE ---------------- */
            pipeline.push({
                $unionWith: {
                    coll: 'purchaseinvoices',
                    pipeline: [
                        { $match: purchaseMatch },
                        {
                            $project: {
                                type: { $literal: 'Purchase' },
                                date: '$invoiceDetails.date',
                                invoiceNumber: '$invoiceDetails.invoiceNumber',
                                entityName: '$vendorInformation.ms',
                                gstNo: '$vendorInformation.gstinPan',
                                grandTotal: '$totals.grandTotal',
                                items: 1,
                                staff: '$staff',
                                totals: 1,
                                invoiceDetails: 1
                            }
                        }
                    ]
                }
            });

            /* ---------------- COMMON FILTERS ---------------- */
            const commonMatch = {};

            if (customerVendor) {
                commonMatch.entityName = { $regex: customerVendor, $options: 'i' };
            }

            if (gstNo) {
                commonMatch.gstNo = { $regex: gstNo, $options: 'i' };
            }

            if (Object.keys(commonMatch).length > 0) {
                pipeline.push({ $match: commonMatch });
            }

            /* ---------------- ITEM DETAIL ---------------- */
            if (showItemDetail) {
                pipeline.push({ $unwind: '$items' });
            }

            /* ---------------- GROUP BY CUSTOMER ---------------- */
            if (groupRecordByCustomer) {
                pipeline.push({
                    $group: {
                        _id: '$entityName',
                        records: { $push: '$$ROOT' },
                        totalAmount: { $sum: '$grandTotal' },
                        count: { $sum: 1 }
                    }
                });
            }

            /* ---------------- SORT (FIXED) ---------------- */
            const sortStage = {};

            if (groupRecordByCustomer) {
                sortStage.totalAmount = sortOrder === 'asc' ? 1 : -1;
            } else {
                const sortKey = sortBy === 'date' ? 'date' : sortBy;
                sortStage[sortKey] = sortOrder === 'asc' ? 1 : -1;
            }

            pipeline.push({ $sort: sortStage });

            /* ---------------- PROJECTION ---------------- */
            if (!groupRecordByCustomer) {
                const projectStage = {
                    date: 1,
                    type: 1,
                    invoiceNumber: 1,
                    entityName: 1,
                    gstNo: 1,
                    grandTotal: 1
                };

                if (showItemDetail) {
                    projectStage.itemName = '$items.productName';
                    projectStage.itemQty = '$items.qty';
                    projectStage.itemTotal = '$items.total';
                    projectStage.itemPrice = '$items.price';
                }

                pipeline.push({ $project: projectStage });
            }

            /* ---------------- PAGINATION ---------------- */
            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: 'total' }]
                }
            });

            const result = await SaleInvoice.aggregate(pipeline).allowDiskUse(true);

            const docs = result[0]?.docs || [];
            const total = result[0]?.totalCount?.[0]?.total || 0;

            return {
                success: true,
                data: {
                    docs,
                    totalDocs: total,
                    limit: Number(limit),
                    totalPages: Math.ceil(total / limit),
                    page: Number(page)
                }
            };

        } catch (error) {
            console.error('Company Ledger Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            columns: [
                'Date',
                'Invoice No',
                'Entity Name',
                'GST No',
                'Type',
                'Grand Total',
                'Item Name',
                'Quantity',
                'Item Total'
            ]
        };
    }
}

module.exports = CompanyLedgerReportModel;
