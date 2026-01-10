const mongoose = require('mongoose');
const Quotation = require('../Other-Document-Model/Quotation');
const Proforma = require('../Other-Document-Model/Proforma');
const DeliveryChallan = require('../Other-Document-Model/DeliveryChallan');
const PurchaseOrder = require('../Other-Document-Model/PurchaseOrder');
const SaleOrder = require('../Other-Document-Model/SaleOrder');
const JobWork = require('../Other-Document-Model/JobWork');
const CreditNote = require('../Other-Document-Model/CreditNote');
const DebitNote = require('../Other-Document-Model/DebitNote');
const Product = require('../Product-Service-Model/Product');

class OtherDocumentReportModel {

    static getModelConfig(reportType) {
        const mapping = {
            quotation: {
                model: Quotation,
                paths: {
                    date: 'quotationDetails.date',
                    number: 'quotationDetails.quotationNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'quotationDetails.quotationPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            proforma: {
                model: Proforma,
                paths: {
                    date: 'proformaDetails.date',
                    number: 'proformaDetails.proformaNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'proformaDetails.proformaPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            deliveryChallan: {
                model: DeliveryChallan,
                paths: {
                    date: 'deliveryChallanDetails.date',
                    number: 'deliveryChallanDetails.challanNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'deliveryChallanDetails.challanPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            purchaseOrder: {
                model: PurchaseOrder,
                paths: {
                    date: 'purchaseOrderDetails.date',
                    number: 'purchaseOrderDetails.poNumber',
                    entity: 'vendorInformation.ms',
                    prefix: 'purchaseOrderDetails.poPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            saleOrder: {
                model: SaleOrder,
                paths: {
                    date: 'saleOrderDetails.date',
                    number: 'saleOrderDetails.soNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'saleOrderDetails.soPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            jobWork: {
                model: JobWork,
                paths: {
                    date: 'jobWorkDetails.date',
                    number: 'jobWorkDetails.jwNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'jobWorkDetails.jwPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            creditNote: {
                model: CreditNote,
                paths: {
                    date: 'creditNoteDetails.cnDate',
                    number: 'creditNoteDetails.cnNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'creditNoteDetails.cnPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            },
            debitNote: {
                model: DebitNote,
                paths: {
                    date: 'debitNoteDetails.dnDate',
                    number: 'debitNoteDetails.dnNumber',
                    entity: 'vendorInformation.ms',
                    prefix: 'debitNoteDetails.dnPrefix',
                    grandTotal: 'totals.grandTotal'
                }
            }
        };
        return mapping[reportType];
    }

    static async getOtherDocumentReport(filters = {}, options = {}) {
        try {
            const {
                reportType,
                userId,
                customerVendor,
                products,
                productGroup,
                documentNumber,
                invoiceSeries,
                fromDate,
                toDate,
                groupingOptions
            } = filters;

            const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc' } = options;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const config = this.getModelConfig(reportType);
            if (!config) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const { model, paths } = config;
            const pipeline = [];

            const matchStage = { userId: new mongoose.Types.ObjectId(userId) };

            if (fromDate || toDate) {
                matchStage[paths.date] = {};
                if (fromDate) matchStage[paths.date].$gte = new Date(fromDate);
                if (toDate) {
                    const eod = new Date(toDate);
                    eod.setUTCHours(23, 59, 59, 999);
                    matchStage[paths.date].$lte = eod;
                }
            }

            if (customerVendor && paths.entity) {
                matchStage[paths.entity] = { $regex: customerVendor, $options: 'i' };
            }

            if (documentNumber) {
                matchStage[paths.number] = { $regex: documentNumber, $options: 'i' };
            }

            if (invoiceSeries && paths.prefix) {
                matchStage[paths.prefix] = { $regex: invoiceSeries, $options: 'i' };
            }

            pipeline.push({ $match: matchStage });

            let productNamesFromGroup = [];
            if (productGroup?.length) {
                const productsFromGroup = await Product.find({
                    userId: new mongoose.Types.ObjectId(userId),
                    productGroup: { $in: productGroup }
                }).select('name').lean();

                productNamesFromGroup = productsFromGroup.map(p => p.name);
            }

            const needsUnwind =
                products?.length ||
                productNamesFromGroup.length ||
                groupingOptions === 'Product';

            if (needsUnwind) {
                pipeline.push({ $unwind: '$items' });

                const itemMatch = {};
                if (products?.length) itemMatch['items.productName'] = { $in: products };
                if (productNamesFromGroup.length) {
                    itemMatch['items.productName'] = { $in: productNamesFromGroup };
                }

                if (Object.keys(itemMatch).length) {
                    pipeline.push({ $match: itemMatch });
                }
            }

            if (groupingOptions === 'Product') {
                pipeline.push({
                    $group: {
                        _id: '$items.productName',
                        totalQuantity: { $sum: '$items.qty' },
                        totalAmount: { $sum: '$items.total' }
                    }
                });
            } else {
                pipeline.push({
                    $project: {
                        date: `$${paths.date}`,
                        number: `$${paths.number}`,
                        entityName: paths.entity ? `$${paths.entity}` : { $literal: '' },
                        grandTotal: paths.grandTotal ? `$${paths.grandTotal}` : { $literal: 0 },
                        itemName: needsUnwind ? '$items.productName' : undefined,
                        itemQty: needsUnwind ? '$items.qty' : undefined,
                        itemTotal: needsUnwind ? '$items.total' : undefined
                    }
                });
            }

            // ✅ SORT ON PROJECTED FIELDS
            pipeline.push({
                $sort: {
                    [sortBy === 'date' ? 'date' : sortBy]: sortOrder === 'asc' ? 1 : -1
                }
            });

            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: 'total' }]
                }
            });

            const result = await model.aggregate(pipeline);
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
            console.error('Other Document Report Error:', error);
            return { success: false, message: error.message };
        }
    }
}

module.exports = OtherDocumentReportModel;
