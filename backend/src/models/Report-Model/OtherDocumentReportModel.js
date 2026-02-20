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
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            proforma: {
                model: Proforma,
                paths: {
                    date: 'proformaDetails.date',
                    number: 'proformaDetails.proformaNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'proformaDetails.proformaPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            deliveryChallan: {
                model: DeliveryChallan,
                paths: {
                    date: 'deliveryChallanDetails.date',
                    number: 'deliveryChallanDetails.challanNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'deliveryChallanDetails.challanPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            purchaseOrder: {
                model: PurchaseOrder,
                paths: {
                    date: 'purchaseOrderDetails.date',
                    number: 'purchaseOrderDetails.poNumber',
                    entity: 'vendorInformation.ms',
                    prefix: 'purchaseOrderDetails.poPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            saleOrder: {
                model: SaleOrder,
                paths: {
                    date: 'saleOrderDetails.date',
                    number: 'saleOrderDetails.soNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'saleOrderDetails.soPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            jobWork: {
                model: JobWork,
                paths: {
                    date: 'jobWorkDetails.date',
                    number: 'jobWorkDetails.jwNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'jobWorkDetails.jwPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            creditNote: {
                model: CreditNote,
                paths: {
                    date: 'creditNoteDetails.cnDate',
                    number: 'creditNoteDetails.cnNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'creditNoteDetails.cnPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            },
            debitNote: {
                model: DebitNote,
                paths: {
                    date: 'debitNoteDetails.dnDate',
                    number: 'debitNoteDetails.dnNumber',
                    entity: 'customerInformation.ms',
                    prefix: 'debitNoteDetails.dnPrefix',
                    grandTotal: 'totals.grandTotal',
                    taxableValue: 'totals.totalTaxable'
                }
            }
        };
        return mapping[reportType];
    }

    static async getOtherDocumentReport(filters = {}, options = {}) {
        try {
            const {
                documentType,
                userId,
                customerVendor,
                products,
                productGroup,
                documentNumber,
                invoiceSeries,
                fromDate,
                toDate,
                groupingOptions,
                staffId,
                status
            } = filters;

            const { page = 1, limit = 50, sortBy = 'date', sortOrder = 'desc' } = options;

            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return { success: true, data: { docs: [], totalDocs: 0 } };
            }

            const config = this.getModelConfig(documentType);
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

            if (staffId) {
                if (mongoose.Types.ObjectId.isValid(staffId)) {
                    matchStage.staff = { $in: [new mongoose.Types.ObjectId(staffId), staffId] };
                } else {
                    matchStage.staff = staffId;
                }
            }

            if (status) {
                // Ensure the model actually uses this status by checking its schema enum
                let validStatuses = [];
                let statusPath = model.schema.path('status');

                // JobWork has status at jobWorkDetails.status
                if (!statusPath && model.schema.path('jobWorkDetails.status')) {
                    statusPath = model.schema.path('jobWorkDetails.status');
                }

                if (statusPath && statusPath.enumValues) {
                    validStatuses = statusPath.enumValues;
                }

                let requestedStatuses = [];
                if (Array.isArray(status)) {
                    requestedStatuses = status;
                } else if (typeof status === 'string' && status.includes(',')) {
                    requestedStatuses = status.split(',').map(s => s.trim());
                } else if (typeof status === 'string') {
                    requestedStatuses = [status];
                }

                // Filter requested statuses against what's valid for this model
                // If there are no enum restrictions, let it query everything.
                let filteredStatuses = requestedStatuses;
                if (validStatuses.length > 0) {
                    filteredStatuses = requestedStatuses.filter(s => validStatuses.includes(s));
                }

                if (filteredStatuses.length > 0) {
                    // Apply dynamically to root status or nested if needed
                    const statusField = model.modelName === 'JobWork' ? 'jobWorkDetails.status' : 'status';
                    matchStage[statusField] = { $in: filteredStatuses };
                }
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
                        documentType: { $literal: documentType },
                        date: `$${paths.date}`,
                        number: `$${paths.number}`,
                        entityName: paths.entity ? `$${paths.entity}` : { $literal: '' },
                        taxableValue: paths.taxableValue ? `$${paths.taxableValue}` : { $literal: 0 },
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
    static getFilterMetadata(documentType = 'quotation') {
        let docTypeLabel = 'Quotation';
        if (documentType === 'jobWork') docTypeLabel = 'Job Work';
        else if (documentType === 'proforma') docTypeLabel = 'Proforma Invoice';
        else if (documentType === 'deliveryChallan') docTypeLabel = 'Delivery Challan';
        else if (documentType === 'purchaseOrder') docTypeLabel = 'Purchase Order';
        else if (documentType === 'saleOrder') docTypeLabel = 'Sale Order';
        else if (documentType === 'creditNote') docTypeLabel = 'Credit Note';
        else if (documentType === 'debitNote') docTypeLabel = 'Debit Note';

        return {
            groupingOptions: ['Product Name'],
            columns: [
                { field: 'documentType', label: 'Vch Type' },
                { field: 'number', label: `${docTypeLabel} No` },
                { field: 'date', label: `${docTypeLabel} Date` },
                { field: 'entityName', label: 'Company Name' },
                { field: 'taxableValue', label: 'Taxable Value Total' },
                { field: 'grandTotal', label: 'Grand Total' }
            ]
        };
    }
}

module.exports = OtherDocumentReportModel;
