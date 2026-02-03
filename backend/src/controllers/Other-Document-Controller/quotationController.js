const Quotation = require('../../models/Other-Document-Model/Quotation');
const QuotationCustomField = require('../../models/Other-Document-Model/QuotationCustomField');
const QuotationItemColumn = require('../../models/Other-Document-Model/QuotationItemColumn');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const { calculateDocumentTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const User = require('../../models/User-Model/User');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};

// Helper to build search query (mirrors DailyExpense buildExpenseQuery)
const buildQuotationQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search, showAll,
        company, customerName,
        product, productName,
        productGroup,
        fromDate, toDate,
        staffName,
        quotationNo, quotationNumber,
        minAmount, maxAmount,
        lrNo, documentNo,
        itemNote,
        remarks, documentRemarks,
        gstin, gstinPan,
        quotationType,
        shipTo, shippingAddress,
        advanceFilter, // { field, operator, value } or stringified
        ...otherFilters
    } = queryParams;

    if (showAll === 'true') return { userId };

    if (search) {
        query.$or = [
            { 'customerInformation.ms': { $regex: search, $options: 'i' } },
            { 'quotationDetails.quotationNumber': { $regex: search, $options: 'i' } },
            { documentRemarks: { $regex: search, $options: 'i' } },
            { 'items.productName': { $regex: search, $options: 'i' } }
        ];
    }

    // Basic Filters
    if (company || customerName) {
        query['customerInformation.ms'] = { $regex: company || customerName, $options: 'i' };
    }

    if (product || productName) {
        query['items.productName'] = { $regex: product || productName, $options: 'i' };
    }

    if (productGroup) {
        query['items.productGroup'] = { $regex: productGroup, $options: 'i' };
    }

    if (quotationNo || quotationNumber) {
        query['quotationDetails.quotationNumber'] = { $regex: quotationNo || quotationNumber, $options: 'i' };
    }

    if (quotationType) {
        query['quotationDetails.quotationType'] = quotationType;
    }

    if (fromDate || toDate) {
        query['quotationDetails.date'] = {};
        if (fromDate) query['quotationDetails.date'].$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query['quotationDetails.date'].$lte = end;
        }
    }

    if (minAmount || maxAmount) {
        query['totals.grandTotal'] = {};
        if (minAmount) query['totals.grandTotal'].$gte = Number(minAmount);
        if (maxAmount) query['totals.grandTotal'].$lte = Number(maxAmount);
    }

    if (lrNo || documentNo) {
        query['transportDetails.documentNo'] = { $regex: lrNo || documentNo, $options: 'i' };
    }

    if (itemNote) {
        query['items.itemNote'] = { $regex: itemNote, $options: 'i' };
    }

    if (remarks || documentRemarks) {
        query.documentRemarks = { $regex: remarks || documentRemarks, $options: 'i' };
    }

    if (gstin || gstinPan) {
        query['customerInformation.gstinPan'] = { $regex: gstin || gstinPan, $options: 'i' };
    }

    if (shipTo || shippingAddress) {
        query['customerInformation.shipTo'] = { $regex: shipTo || shippingAddress, $options: 'i' };
    }

    if (staffName) {
        const staffDocs = await Staff.find({
            ownerRef: userId,
            fullName: { $regex: staffName, $options: 'i' }
        }).select('_id');
        query.staff = { $in: staffDocs.map(s => s._id) };
    }

    // Advance Filters
    if (advanceFilter) {
        let af = advanceFilter;
        if (typeof advanceFilter === 'string') {
            try { af = JSON.parse(advanceFilter); } catch (e) { af = null; }
        }

        if (af && af.field && af.operator) {
            const fieldMap = {
                'Contact No': 'customerInformation.phone',
                'City': 'customerInformation.address',
                'State': 'customerInformation.placeOfSupply',
                'Vehicle No': 'transportDetails.vehicleNo',
                'Taxable Total': 'totals.totalTaxable',
                'Transport Name': 'transportDetails.transportName',
                'Document Note': 'items.itemNote',
                'Shipping Name': 'customerInformation.shipTo',
                'Shipping State': 'customerInformation.shipTo',
                'Shipping City': 'customerInformation.shipTo'
            };

            const dbField = fieldMap[af.field] || af.field;
            let val = af.value;

            switch (af.operator) {
                case 'equals':
                    query[dbField] = val;
                    break;
                case 'contains':
                    query[dbField] = { $regex: val, $options: 'i' };
                    break;
                case 'startsWith':
                    query[dbField] = { $regex: '^' + val, $options: 'i' };
                    break;
                case 'endsWith':
                    query[dbField] = { $regex: val + '$', $options: 'i' };
                    break;
                case 'greaterThan':
                    query[dbField] = { $gt: Number(val) };
                    break;
                case 'lessThan':
                    query[dbField] = { $lt: Number(val) };
                    break;
                case 'between':
                    if (val && typeof val === 'string' && val.includes(',')) {
                        const [v1, v2] = val.split(',').map(v => Number(v.trim()));
                        query[dbField] = { $gte: v1, $lte: v2 };
                    }
                    break;
            }
        }
    }

    // Custom Fields filters
    for (const key in otherFilters) {
        if (key.startsWith('cf_')) {
            const fieldId = key.replace('cf_', '');
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create Quotation
// @route   POST /api/quotations
const createQuotation = async (req, res) => {
    try {
        const {
            customerInformation,
            quotationDetails,
            transportDetails,
            items,
            totals,
            paymentType,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields,
            print
        } = req.body;

        // Distance Calculation
        let finalShippingAddress = req.body.shippingAddress || {};
        if (req.body.useSameShippingAddress) {
            finalShippingAddress = {
                street: customerInformation.address,
                city: customerInformation.city || '',
                state: customerInformation.state || '',
                country: customerInformation.country || 'India',
                pincode: customerInformation.pincode || ''
            };
        }

        const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
        finalShippingAddress.distance = distance;

        // Custom Fields Validation (Atomic behavior reuse)
        let parsedCustomFields = {};
        if (customFields) {
            parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
        }
        const definitions = await QuotationCustomField.find({ userId: req.user._id, status: 'Active' });
        for (const def of definitions) {
            if (def.required && !parsedCustomFields[def._id.toString()]) {
                return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
            }
        }

        // --- Items Processing & Calculation ---
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        const calculationResults = await calculateDocumentTotals(req.user._id, {
            customerInformation,
            items: parsedItems,
            additionalCharges: req.body.additionalCharges
        }, req.body.branch);

        const newQuotation = new Quotation({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            quotationDetails,
            transportDetails,
            items: calculationResults.items,
            totals: calculationResults.totals,
            additionalCharges: req.body.additionalCharges || [],
            paymentType,
            staff,
            branch: req.body.branch,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            customFields: parsedCustomFields
        });

        await newQuotation.save();

        if (print) {
            const userData = await User.findById(req.user._id);
            const options = getCopyOptions(req);
            const templateName = await getSelectedPrintTemplate(req.user._id, 'Quotation');
            const pdfBuffer = await generateSaleInvoicePDF(newQuotation, userData, options, 'Quotation', templateName);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=quotation-${newQuotation.quotationDetails.quotationNumber}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({
            success: true,
            message: 'Quotation created successfully',
            data: newQuotation
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Quotation number must be unique' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Quotation
// @route   GET /api/quotations/:id/print
const printQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Quotation', quotation.branch);
        const pdfBuffer = await generateSaleInvoicePDF(quotation, userData, options, 'Quotation', printConfig);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=quotation-${quotation.quotationDetails.quotationNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const downloadQuotationPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const quotations = await Quotation.find({ _id: { $in: ids }, userId: req.user._id });
        if (!quotations || quotations.length === 0) return res.status(404).json({ success: false, message: "Quotation(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Quotation', quotations[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(quotations, userData, options, 'Quotation', printConfig);

        const filename = quotations.length === 1 ? `Quotation_${quotations[0].quotationDetails.quotationNumber}.pdf` : `Merged_Quotations.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareQuotationEmail = async (req, res) => {
    try {
        const { sendInvoiceEmail } = require('../../utils/emailHelper');
        // Filter out invalid IDs and clean them
        const ids = req.params.id.split(',').map(id => id.trim()).filter(id => mongoose.Types.ObjectId.isValid(id));

        if (ids.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid Quotation ID(s) provided" });
        }

        const quotations = await Quotation.find({ _id: { $in: ids }, userId: req.user._id });

        // Return clear error if any ID is missing
        if (quotations.length !== ids.length) {
            const foundIds = quotations.map(q => q._id.toString());
            const missingIds = ids.filter(id => !foundIds.includes(id));
            return res.status(404).json({
                success: false,
                message: "Some Quotation(s) were not found",
                missingIds
            });
        }

        const firstDoc = quotations[0];
        if (!firstDoc?.customerInformation?.ms) {
            return res.status(400).json({ success: false, message: "Quotation data is incomplete" });
        }

        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || customer?.email;

        if (!email) {
            return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });
        }

        const options = getCopyOptions(req);
        await sendInvoiceEmail(quotations, email, false, options, 'Quotation');
        res.status(200).json({ success: true, message: `Quotation(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareQuotationWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const quotations = await Quotation.find({ _id: { $in: ids }, userId: req.user._id });
        if (!quotations || quotations.length === 0) return res.status(404).json({ success: false, message: "Quotation(s) not found" });

        const firstDoc = quotations[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const phone = req.body.phone || (customer ? customer.phone : null);

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const token = generatePublicToken(req.params.id);
        // Assuming there is a public view for Quotations similar to Sale Invoice
        const publicLink = `${req.protocol}://${req.get('host')}/api/quotations/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (quotations.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Quotation No: ${firstDoc.quotationDetails.quotationNumber} for Total Amount: ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Quotations for Total Amount: ${quotations.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        }

        const encodedMessage = encodeURIComponent(message);
        const deepLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        res.status(200).json({
            success: true,
            message: "WhatsApp share link generated",
            data: { whatsappNumber, deepLink }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get All Quotations
// @route   GET /api/quotations
const getQuotations = async (req, res) => {
    try {
        const query = await buildQuotationQuery(req.user._id, req.query);
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;

        const skip = (page - 1) * limit;
        const sortOptions = { [sort]: order === 'desc' ? -1 : 1 };

        // Fetch paginated data
        const quotations = await Quotation.find(query)
            .sort(sortOptions)
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const total = await Quotation.countDocuments(query);

        res.status(200).json({
            success: true,
            count: quotations.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: quotations
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getQuotationSummary = async (req, res) => {
    try {
        const query = await buildQuotationQuery(req.user._id, req.query);
        const data = await getSummaryAggregation(req.user._id, query, Quotation);
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Single Quotation
// @route   GET /api/quotations/:id
const getQuotationById = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update Quotation
// @route   PUT /api/quotations/:id
const updateQuotation = async (req, res) => {
    try {
        // Distance Calculation
        // Fetch current quotation to get existing customerInformation if not provided in req.body
        let currentQuotationForDistance = null;
        if (req.body.shippingAddress || req.body.useSameShippingAddress || req.body.customerInformation) {
            currentQuotationForDistance = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
            if (!currentQuotationForDistance && (req.body.useSameShippingAddress && !req.body.customerInformation)) {
                return res.status(404).json({ success: false, message: 'Quotation not found for distance calculation' });
            }

            let finalShippingAddress = req.body.shippingAddress || {};
            if (req.body.useSameShippingAddress) {
                const effectiveCustomerInfo = req.body.customerInformation || (currentQuotationForDistance ? currentQuotationForDistance.customerInformation : null);
                if (effectiveCustomerInfo) {
                    finalShippingAddress = {
                        street: effectiveCustomerInfo.address || '',
                        city: effectiveCustomerInfo.city || '',
                        state: effectiveCustomerInfo.state || '',
                        country: effectiveCustomerInfo.country || 'India',
                        pincode: effectiveCustomerInfo.pincode || ''
                    };
                }
            }
            const distance = await calculateShippingDistance(req.user._id, finalShippingAddress);
            finalShippingAddress.distance = distance;
            req.body.shippingAddress = finalShippingAddress;
        }

        // --- Recalculate Totals ---
        if (req.body.items || req.body.customerInformation || req.body.additionalCharges || req.body.branch) {
            const currentQuotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
            if (currentQuotation) {
                const calculationResults = await calculateDocumentTotals(req.user._id, {
                    customerInformation: req.body.customerInformation || currentQuotation.customerInformation,
                    items: req.body.items || currentQuotation.items,
                    additionalCharges: req.body.additionalCharges || currentQuotation.additionalCharges
                }, req.body.branch || currentQuotation.branch);

                req.body.items = calculationResults.items;
                req.body.totals = calculationResults.totals;
            }
        }

        const quotation = await Quotation.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $set: req.body },
            { new: true, runValidators: true }
        ).populate('staff', 'fullName');

        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, data: quotation });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Quotation
// @route   DELETE /api/quotations/:id
const deleteQuotation = async (req, res) => {
    try {
        const quotation = await Quotation.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });
        res.status(200).json({ success: true, message: 'Quotation deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Custom Field Handlers (Mirror Daily Expense) ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await QuotationCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createCustomField = async (req, res) => {
    try {
        const field = await QuotationCustomField.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomField = async (req, res) => {
    try {
        const field = await QuotationCustomField.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );
        res.status(200).json({ success: true, data: field });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteCustomField = async (req, res) => {
    try {
        await QuotationCustomField.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await QuotationItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const column = await QuotationItemColumn.create({ ...req.body, userId: req.user._id });
        res.status(201).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const column = await QuotationItemColumn.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            req.body,
            { new: true }
        );
        res.status(200).json({ success: true, data: column });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const deleteItemColumn = async (req, res) => {
    try {
        await QuotationItemColumn.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Sale Invoice (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-invoice
const convertToSaleInvoiceData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) {
            return res.status(404).json({ success: false, message: 'Quotation not found' });
        }

        const data = quotation.toObject();

        // Map data to Sale Invoice structure for frontend prefilling
        const mappedData = {
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discountValue: item.discount, // Quotation uses 'discount', Invoice uses 'discountValue'
                discountType: 'Percentage', // Defaulting to Percentage as Quotation discount is usually percentage
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty, // Simple estimate, will be recalculated on save
                total: item.total
            })),
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            paymentType: data.paymentType,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: {
                    docType: 'Quotation',
                    docId: quotation._id
                }
            }
        };

        res.status(200).json({
            success: true,
            message: 'Quotation data for conversion retrieved',
            data: mappedData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Setup conversion to Purchase Invoice (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-purchase-invoice
const convertToPurchaseInvoiceData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            vendorInformation: data.customerInformation, // Map Customer to Vendor
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discountValue: item.discount,
                discountType: 'Percentage',
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: item.price * item.qty,
                total: item.total
            })),
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            paymentType: data.paymentType,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Purchase Invoice conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Proforma  (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-proforma
const convertToProformaData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items,
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            paymentType: data.paymentType,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Proforma conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Delivery Challan (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-challan
const convertToChallanData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items,
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Delivery Challan conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Setup conversion to Purchase Order (Prefill Data)
// @route   GET /api/quotations/:id/convert-to-purchase-order
const convertToPurchaseOrderData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            vendorInformation: data.customerInformation, // Map Customer to Vendor
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items,
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Purchase Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// @desc    Get data for duplicating a Quotation (Prefill Add Form)
// @route   GET /api/quotations/:id/duplicate
const getDuplicateQuotationData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();

        // System fields to exclude
        delete data._id;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;
        delete data.conversions;
        delete data.attachments;

        // Reset document number
        if (data.quotationDetails) {
            delete data.quotationDetails.quotationNumber;
        }

        // Linked references to exclude (optional, but consistent with PO duplicate)
        delete data.staff;
        delete data.branch;

        // Reset sub-document IDs
        if (Array.isArray(data.items)) {
            data.items = data.items.map(item => {
                delete item._id;
                return item;
            });
        }

        res.status(200).json({
            success: true,
            message: 'Quotation data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// --- Attachment Handlers ---

// @desc    Attach files to Quotation
// @route   POST /api/quotations/:id/attach-file
const attachQuotationFile = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

        const newAttachments = req.files.map(file => ({
            fileName: file.filename,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        }));

        const quotation = await Quotation.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

        await recordActivity(
            req,
            'Attachment',
            'Quotation',
            `Files attached to Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: quotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get Quotation Attachments
// @route   GET /api/quotations/:id/attachments
const getQuotationAttachments = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });
        res.status(200).json({ success: true, data: quotation.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update (Replace) Quotation Attachment
// @route   PUT /api/quotations/:id/attachment/:attachmentId
const updateQuotationAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Quotation not found" });
        }

        const attachmentIndex = quotation.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        // Remove old file
        const oldFile = quotation.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        // Update metadata
        quotation.attachments[attachmentIndex] = {
            _id: quotation.attachments[attachmentIndex]._id, // Keep ID
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await quotation.save();

        await recordActivity(
            req,
            'Update Attachment',
            'Quotation',
            `Attachment replaced for Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: quotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete Quotation Attachment
// @route   DELETE /api/quotations/:id/attachment/:attachmentId
const deleteQuotationAttachment = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: "Quotation not found" });

        const attachment = quotation.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        // Remove from disk
        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        // Remove from array
        quotation.attachments = quotation.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await quotation.save();

        const updatedQuotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });

        await recordActivity(
            req,
            'Delete Attachment',
            'Quotation',
            `Attachment deleted from Quotation: ${quotation.quotationDetails.quotationNumber}`,
            quotation.quotationDetails.quotationNumber
        );

        res.status(200).json({ success: true, message: "Attachment deleted successfully", data: updatedQuotation.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const quotations = await Quotation.find({ _id: { $in: ids }, userId: req.user._id });
        if (!quotations || quotations.length === 0) return res.status(404).json({ success: false, message: "Quotation(s) not found" });

        const token = generatePublicToken(req.params.id);

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/quotations/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const viewQuotationPublic = async (req, res) => {
    try {
        const { id, token } = req.params;

        const expectedToken = generatePublicToken(id);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const ids = id.split(',');
        const quotations = await Quotation.find({ _id: { $in: ids } });
        if (!quotations || quotations.length === 0) return res.status(404).send("Quotation(s) not found");

        const userData = await User.findById(quotations[0].userId);
        const options = getCopyOptions(req);
        const pdfBuffer = await generateSaleInvoicePDF(quotations, userData || {}, options, 'Quotation');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Quotation.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering quotation");
    }
};

// @route   GET /api/quotations/:id/convert-to-sale-order
const convertToSaleOrderData = async (req, res) => {
    try {
        const quotation = await Quotation.findOne({ _id: req.params.id, userId: req.user._id });
        if (!quotation) return res.status(404).json({ success: false, message: 'Quotation not found' });

        const data = quotation.toObject();
        const mappedData = {
            customerInformation: data.customerInformation,
            shippingAddress: data.shippingAddress,
            useSameShippingAddress: data.useSameShippingAddress,
            items: data.items.map(item => ({
                productName: item.productName,
                productGroup: item.productGroup,
                itemNote: item.itemNote,
                hsnSac: item.hsnSac,
                qty: item.qty,
                uom: item.uom,
                price: item.price,
                discount: item.discount,
                discountType: 'Percentage',
                igst: item.igst,
                cgst: item.cgst,
                sgst: item.sgst,
                taxableValue: (item.price || 0) * (item.qty || 0),
                total: item.total
            })),
            additionalCharges: data.additionalCharges || [],
            totals: data.totals,
            staff: data.staff,
            branch: data.branch,
            bankDetails: data.bankDetails,
            termsTitle: data.termsTitle,
            termsDetails: data.termsDetails,
            documentRemarks: data.documentRemarks,
            customFields: data.customFields || {},
            conversions: {
                convertedFrom: { docType: 'Quotation', docId: quotation._id }
            }
        };
        res.status(200).json({ success: true, message: 'Quotation data for Sale Order conversion retrieved', data: mappedData });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

module.exports = {
    createQuotation,
    getQuotations,
    getQuotationSummary,
    getQuotationById,
    updateQuotation,
    deleteQuotation,
    printQuotation,
    downloadQuotationPDF,
    shareQuotationEmail,
    shareQuotationWhatsApp,
    convertToSaleInvoiceData,
    convertToPurchaseInvoiceData,
    convertToProformaData,
    convertToChallanData,
    convertToPurchaseOrderData,
    convertToSaleOrderData,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    attachQuotationFile,
    getQuotationAttachments,
    updateQuotationAttachment,
    deleteQuotationAttachment,
    generatePublicLink,
    viewQuotationPublic,
    getDuplicateQuotationData
};
