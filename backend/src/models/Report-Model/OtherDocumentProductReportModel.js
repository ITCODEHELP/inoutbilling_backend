const mongoose = require('mongoose');
const Quotation = require('../Other-Document-Model/Quotation');
const Proforma = require('../Other-Document-Model/Proforma');
const DeliveryChallan = require('../Other-Document-Model/DeliveryChallan');
const PurchaseOrder = require('../Other-Document-Model/PurchaseOrder');
const SaleOrder = require('../Other-Document-Model/SaleOrder');
const JobWork = require('../Other-Document-Model/JobWork');
const CreditNote = require('../Other-Document-Model/CreditNote');
const DebitNote = require('../Other-Document-Model/DebitNote');
const MultiCurrencyExportInvoice = require('../Other-Document-Model/Multi-CurrencyExportInvoice');
const Manufacture = require('../Other-Document-Model/Manufacture');
const PackingList = require('../Other-Document-Model/PackingList');
const Letter = require('../Other-Document-Model/Letter');

class OtherDocumentProductReportModel {

    static getModelConfig(reportType) {
        const mapping = {
            quotation: {
                model: Quotation,
                paths: {
                    date: 'quotationDetails.date',
                    number: 'quotationDetails.quotationNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'quotationDetails.quotationPrefix'
                }
            },
            proforma: {
                model: Proforma,
                paths: {
                    date: 'proformaDetails.date',
                    number: 'proformaDetails.proformaNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'proformaDetails.proformaPrefix'
                }
            },
            deliveryChallan: {
                model: DeliveryChallan,
                paths: {
                    date: 'deliveryChallanDetails.date',
                    number: 'deliveryChallanDetails.challanNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'deliveryChallanDetails.challanPrefix'
                }
            },
            purchaseOrder: {
                model: PurchaseOrder,
                paths: {
                    date: 'purchaseOrderDetails.date',
                    number: 'purchaseOrderDetails.poNumber',
                    entity: 'vendorInformation.ms',
                    prefix: 'purchaseOrderDetails.poPrefix'
                }
            },
            saleOrder: {
                model: SaleOrder,
                paths: {
                    date: 'saleOrderDetails.date',
                    number: 'saleOrderDetails.soNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'saleOrderDetails.soPrefix'
                }
            },
            jobWork: {
                model: JobWork,
                paths: {
                    date: 'jobWorkDetails.date',
                    number: 'jobWorkDetails.jwNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'jobWorkDetails.jwPrefix'
                }
            },
            creditNote: {
                model: CreditNote,
                paths: {
                    date: 'creditNoteDetails.cnDate',
                    number: 'creditNoteDetails.cnNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'creditNoteDetails.cnPrefix'
                }
            },
            debitNote: {
                model: DebitNote,
                paths: {
                    date: 'debitNoteDetails.dnDate',
                    number: 'debitNoteDetails.dnNumber',
                    entity: 'vendorInformation.ms',
                    prefix: 'debitNoteDetails.dnPrefix'
                }
            },
            exportInvoice: {
                model: MultiCurrencyExportInvoice,
                paths: {
                    date: 'invoiceDetails.date',
                    number: 'invoiceDetails.invoiceNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'invoiceDetails.invoicePrefix'
                }
            }
        };
        return mapping[reportType];
    }

    static async getOtherDocumentProductReport(filters = {}, options = {}) {
        try {
            const {
                reportType,
                userId,
                customerVendor,
                productGroup,
                products,
                invoiceNumber,
                invoiceSeries,
                fromDate,
                toDate,
                staffId,
                groupProductBy,
                showPrimaryUOM,
                advanceFilters
            } = filters;

            const {
                page = 1,
                limit = 50,
                sortBy = 'totalAmount',
                sortOrder = 'desc'
            } = options;

            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const config = this.getModelConfig(reportType);
            if (!config) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const { model, paths } = config;
            const pipeline = [];

            /* ---------- DOCUMENT LEVEL MATCH ---------- */
            const matchStage = {
                userId: new mongoose.Types.ObjectId(userId)
            };

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

            if (invoiceNumber) {
                matchStage[paths.number] = { $regex: invoiceNumber, $options: 'i' };
            }

            if (invoiceSeries && paths.prefix) {
                matchStage[paths.prefix] = { $regex: invoiceSeries, $options: 'i' };
            }

            if (staffId) {
                matchStage.staff = mongoose.Types.ObjectId.isValid(staffId)
                    ? new mongoose.Types.ObjectId(staffId)
                    : staffId;
            }

            pipeline.push({ $match: matchStage });

            /* ---------- UNWIND ITEMS ---------- */
            pipeline.push({ $unwind: '$items' });

            /* ---------- ITEM LEVEL MATCH ---------- */
            const itemMatch = {};

            if (products?.length) {
                itemMatch['items.productName'] = { $in: products };
            }

            if (productGroup?.length) {
                itemMatch['items.productGroup'] = { $in: productGroup };
            }

            if (Object.keys(itemMatch).length) {
                pipeline.push({ $match: itemMatch });
            }

            /* ---------- ADVANCED FILTERS ---------- */
            if (advanceFilters?.length) {
                const advMatch = {};
                advanceFilters.forEach(f => {
                    let field = f.field;
                    if (field === 'Qty') field = 'items.qty';
                    if (field === 'Amount') field = 'items.total';
                    if (field === 'Price') field = 'items.price';

                    if (f.operator === 'equals') advMatch[field] = f.value;
                    if (f.operator === 'contains') advMatch[field] = { $regex: f.value, $options: 'i' };
                    if (f.operator === 'greaterThan') advMatch[field] = { $gt: Number(f.value) };
                    if (f.operator === 'lessThan') advMatch[field] = { $lt: Number(f.value) };
                });

                if (Object.keys(advMatch).length) {
                    pipeline.push({ $match: advMatch });
                }
            }

            /* ---------- GROUPING ---------- */
            let groupId = '$items.productName';
            if (groupProductBy === 'HSN') groupId = '$items.hsnSac';
            if (groupProductBy === 'Product Group') groupId = '$items.productGroup';

            const groupStage = {
                _id: groupId,
                totalQuantity: { $sum: '$items.qty' },
                totalAmount: { $sum: '$items.total' },
                avgPrice: { $avg: '$items.price' },
                count: { $sum: 1 }
            };

            if (showPrimaryUOM) {
                groupStage.uom = { $first: '$items.uom' };
            }

            pipeline.push({ $group: groupStage });

            /* ---------- SORT ---------- */
            pipeline.push({
                $sort: {
                    [sortBy === 'totalQuantity' ? 'totalQuantity' : 'totalAmount']:
                        sortOrder === 'asc' ? 1 : -1
                }
            });

            /* ---------- PAGINATION ---------- */
            pipeline.push({
                $facet: {
                    docs: [
                        { $skip: (page - 1) * limit },
                        { $limit: Number(limit) }
                    ],
                    totalCount: [{ $count: 'total' }]
                }
            });

            const result = await model.aggregate(pipeline).allowDiskUse(true);
            const docs = result[0].docs;
            const total = result[0].totalCount[0]?.total || 0;

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
            console.error('Other Document Product Report Error:', error);
            return { success: false, message: error.message };
        }
    }

    static getFilterMetadata() {
        return {
            groupingOptions: ['Product Name', 'HSN', 'Product Group'],
            columns: ['Product Name', 'Quantity', 'Amount', 'Avg Price']
        };
    }
}

module.exports = OtherDocumentProductReportModel;
