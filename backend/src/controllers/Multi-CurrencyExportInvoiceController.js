const ExportInvoice = require('../models/Multi-CurrencyExportInvoice');
const { calculateExportInvoiceTotals, getSummaryAggregation } = require('../utils/documentHelper');
const { calculateShippingDistance } = require('../utils/shippingHelper');
const { sendInvoiceEmail } = require('../utils/emailHelper');
const Customer = require('../models/Customer');
const mongoose = require('mongoose');

// Generate Export Invoice Number (following same pattern as other invoices)
const generateExportInvoiceNumber = async (userId) => {
    const lastInvoice = await ExportInvoice.findOne({ userId }).sort({ createdAt: -1 });
    if (!lastInvoice || !lastInvoice.invoiceDetails?.invoiceNumber) {
        return 'EXP-0001';
    }
    const lastNumber = parseInt(lastInvoice.invoiceDetails.invoiceNumber.split('-')[1]) || 0;
    return `EXP-${String(lastNumber + 1).padStart(4, '0')}`;
};

/**
 * @desc    Create Export Invoice
 * @route   POST /api/export-invoice
 */
const createExportInvoice = async (req, res) => {
    try {
        const {
            customerInformation,
            invoiceDetails = {},
            currency,
            exportShippingDetails,
            shippingAddress,
            useSameShippingAddress,
            items,
            additionalCharges,
            branch,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            shareOnEmail,
            customFields
        } = req.body;

        // Validation
        if (!customerInformation?.ms) {
            return res.status(400).json({
                success: false,
                message: 'Customer M/S is required'
            });
        }

        if (!customerInformation?.placeOfSupply) {
            return res.status(400).json({
                success: false,
                message: 'Place of Supply is required'
            });
        }

        if (!invoiceDetails.invoiceType || !['Export Invoice (With IGST)', 'Export Invoice (Without IGST)'].includes(invoiceDetails.invoiceType)) {
            return res.status(400).json({
                success: false,
                message: 'Invoice Type must be "Export Invoice (With IGST)" or "Export Invoice (Without IGST)"'
            });
        }

        if (!exportShippingDetails) {
            return res.status(400).json({
                success: false,
                message: 'Export Shipping Details are required'
            });
        }

        if (!exportShippingDetails.shipBillNo) {
            return res.status(400).json({
                success: false,
                message: 'Shipping Bill Number is required'
            });
        }

        if (!exportShippingDetails.shipBillDate) {
            return res.status(400).json({
                success: false,
                message: 'Shipping Bill Date is required'
            });
        }

        if (!exportShippingDetails.shipPortCode) {
            return res.status(400).json({
                success: false,
                message: 'Port Code is required'
            });
        }

        if (!exportShippingDetails.portOfLoading) {
            return res.status(400).json({
                success: false,
                message: 'Port of Loading is required'
            });
        }

        if (!exportShippingDetails.portOfDischarge) {
            return res.status(400).json({
                success: false,
                message: 'Port of Discharge is required'
            });
        }

        if (!exportShippingDetails.finalDestination) {
            return res.status(400).json({
                success: false,
                message: 'Final Destination is required'
            });
        }

        if (!exportShippingDetails.countryOfOrigin) {
            return res.status(400).json({
                success: false,
                message: 'Country of Origin is required'
            });
        }

        if (!exportShippingDetails.countryOfFinal) {
            return res.status(400).json({
                success: false,
                message: 'Country of Final Destination is required'
            });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Items array must not be empty'
            });
        }

        // Validate items
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item.productName) {
                return res.status(400).json({
                    success: false,
                    message: `Product Name is required for item ${i + 1}`
                });
            }
            if (!item.qty || item.qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Quantity must be greater than 0 for item ${i + 1}`
                });
            }
            if (!item.price || item.price <= 0) {
                return res.status(400).json({
                    success: false,
                    message: `Price must be greater than 0 for item ${i + 1}`
                });
            }
        }

        const effectiveBranch = branch && branch.state ? branch : (branch?._id || branch);
        const calculationBranchId = (effectiveBranch && effectiveBranch.state) ? effectiveBranch : (effectiveBranch && mongoose.Types.ObjectId.isValid(effectiveBranch) ? effectiveBranch : null);

        // Resolve shipping address
        let finalShippingAddress = {};

        if (useSameShippingAddress === true) {
            finalShippingAddress = {
                street: customerInformation?.address || '',
                city: customerInformation?.city || '',
                state: customerInformation?.state || '',
                country: customerInformation?.country || 'India',
                pincode: customerInformation?.pincode || ''
            };
        } else {
            finalShippingAddress = shippingAddress || {};
        }

        // Calculate distance
        if (finalShippingAddress?.pincode) {
            const distance = await calculateShippingDistance(
                req.user._id,
                finalShippingAddress,
                calculationBranchId
            );
            finalShippingAddress.distance = distance;
        } else {
            finalShippingAddress.distance = 0;
        }

        // Generate Invoice Number if not provided
        if (!invoiceDetails.invoiceNumber) {
            const invoiceNumber = await generateExportInvoiceNumber(req.user._id);
            invoiceDetails.invoiceNumber = invoiceNumber;
        }

        // Parse items
        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        // Calculate totals using export invoice calculation
        const currencyCode = currency?.code || 'AED';
        const calculationResults = await calculateExportInvoiceTotals(
            req.user._id,
            {
                customerInformation,
                items: parsedItems,
                additionalCharges: additionalCharges
            },
            invoiceDetails.invoiceType,
            currencyCode
        );

        // Parse custom fields
        let parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields || {};

        const newExportInvoice = new ExportInvoice({
            userId: req.user._id,
            customerInformation,
            useSameShippingAddress: req.body.useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            invoiceDetails: {
                ...invoiceDetails,
                date: invoiceDetails.date ? new Date(invoiceDetails.date) : new Date()
            },
            currency: {
                code: currencyCode,
                symbol: currency?.symbol || currencyCode
            },
            exportShippingDetails: {
                ...exportShippingDetails,
                shipBillDate: new Date(exportShippingDetails.shipBillDate)
            },
            items: calculationResults.items,
            totals: {
                ...calculationResults.totals,
                totalInvoiceValue: calculationResults.totals.grandTotal
            },
            additionalCharges: additionalCharges || [],
            staff,
            branch: effectiveBranch,
            bankDetails,
            termsTitle,
            termsDetails: Array.isArray(termsDetails) ? termsDetails : (termsDetails ? [termsDetails] : []),
            documentRemarks,
            shareOnEmail,
            customFields: parsedCustomFields
        });

        await newExportInvoice.save();

        // Send email if requested
        if (shareOnEmail) {
            const customer = await Customer.findOne({
                userId: req.user._id,
                companyName: customerInformation.ms
            });
            if (customer && customer.email) {
                // Note: PDF generation for export invoices would need to be added to pdfHelper
                // For now, we'll use the existing sendInvoiceEmail function
                try {
                    await sendInvoiceEmail(newExportInvoice, customer.email);
                } catch (emailError) {
                    console.error('Error sending export invoice email:', emailError);
                    // Don't fail the request if email fails
                }
            }
        }

        res.status(201).json({
            success: true,
            message: 'Export Invoice created successfully',
            data: newExportInvoice
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Export Invoice number must be unique'
            });
        }
        console.error('[Export Invoice Create] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all Export Invoices
 * @route   GET /api/export-invoice
 */
const getExportInvoices = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id };
        const total = await ExportInvoice.countDocuments(query);

        const exportInvoices = await ExportInvoice.find(query)
            .populate('staff', 'fullName')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: exportInvoices
        });
    } catch (error) {
        console.error('[Export Invoice Get All] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Export Invoice by ID
 * @route   GET /api/export-invoice/:id
 */
const getExportInvoiceById = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        }).populate('staff', 'fullName');

        if (!exportInvoice) {
            return res.status(404).json({
                success: false,
                message: 'Export Invoice not found'
            });
        }

        res.status(200).json({
            success: true,
            data: exportInvoice
        });
    } catch (error) {
        console.error('[Export Invoice Get By ID] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update Export Invoice
 * @route   PUT /api/export-invoice/:id
 */
const updateExportInvoice = async (req, res) => {
    try {
        const {
            customerInformation,
            invoiceDetails,
            currency,
            exportShippingDetails,
            shippingAddress,
            useSameShippingAddress,
            items,
            additionalCharges,
            branch,
            staff,
            bankDetails,
            termsTitle,
            termsDetails,
            documentRemarks,
            shareOnEmail,
            customFields
        } = req.body;

        const effectiveBranch = branch && branch.state ? branch : (branch?._id || branch);
        const calculationBranchId = (effectiveBranch && effectiveBranch.state) ? effectiveBranch : (effectiveBranch && mongoose.Types.ObjectId.isValid(effectiveBranch) ? effectiveBranch : null);

        // Resolve shipping address
        let finalShippingAddress = {};

        if (useSameShippingAddress === true) {
            finalShippingAddress = {
                street: customerInformation?.address || '',
                city: customerInformation?.city || '',
                state: customerInformation?.state || '',
                country: customerInformation?.country || 'India',
                pincode: customerInformation?.pincode || ''
            };
        } else {
            finalShippingAddress = shippingAddress || {};
        }

        // Calculate distance
        if (finalShippingAddress?.pincode) {
            const distance = await calculateShippingDistance(
                req.user._id,
                finalShippingAddress,
                calculationBranchId
            );
            finalShippingAddress.distance = distance;
        } else {
            finalShippingAddress.distance = 0;
        }

        let parsedItems = Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items) : []);

        // Calculate totals
        const currencyCode = currency?.code || 'AED';
        const invoiceType = invoiceDetails?.invoiceType || 'Export Invoice (With IGST)';
        const calculationResults = await calculateExportInvoiceTotals(
            req.user._id,
            {
                customerInformation,
                items: parsedItems,
                additionalCharges: additionalCharges
            },
            invoiceType,
            currencyCode
        );

        let parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields || {};

        const updateData = {
            customerInformation,
            useSameShippingAddress,
            shippingAddress: finalShippingAddress,
            invoiceDetails: invoiceDetails ? {
                ...invoiceDetails,
                date: invoiceDetails.date ? new Date(invoiceDetails.date) : undefined
            } : undefined,
            currency: currency ? {
                code: currencyCode,
                symbol: currency.symbol || currencyCode
            } : undefined,
            exportShippingDetails: exportShippingDetails ? {
                ...exportShippingDetails,
                shipBillDate: exportShippingDetails.shipBillDate ? new Date(exportShippingDetails.shipBillDate) : undefined
            } : undefined,
            items: calculationResults.items,
            totals: {
                ...calculationResults.totals,
                totalInvoiceValue: calculationResults.totals.grandTotal
            },
            additionalCharges: additionalCharges || [],
            staff,
            branch: effectiveBranch,
            bankDetails,
            termsTitle,
            termsDetails: Array.isArray(termsDetails) ? termsDetails : (termsDetails ? [termsDetails] : []),
            documentRemarks,
            shareOnEmail,
            customFields: parsedCustomFields
        };

        // Remove undefined fields
        Object.keys(updateData).forEach(key => {
            if (updateData[key] === undefined) {
                delete updateData[key];
            }
        });

        const updatedExportInvoice = await ExportInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedExportInvoice) {
            return res.status(404).json({
                success: false,
                message: 'Export Invoice not found'
            });
        }

        // Send email if requested
        if (shareOnEmail) {
            const customer = await Customer.findOne({
                userId: req.user._id,
                companyName: customerInformation?.ms || updatedExportInvoice.customerInformation.ms
            });
            if (customer && customer.email) {
                try {
                    await sendInvoiceEmail(updatedExportInvoice, customer.email);
                } catch (emailError) {
                    console.error('Error sending export invoice email:', emailError);
                }
            }
        }

        res.status(200).json({
            success: true,
            message: 'Export Invoice updated successfully',
            data: updatedExportInvoice
        });
    } catch (error) {
        console.error('[Export Invoice Update] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Export Invoice
 * @route   DELETE /api/export-invoice/:id
 */
const deleteExportInvoice = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!exportInvoice) {
            return res.status(404).json({
                success: false,
                message: 'Export Invoice not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Export Invoice deleted successfully'
        });
    } catch (error) {
        console.error('[Export Invoice Delete] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Search Export Invoices
 * @route   GET /api/export-invoice/search
 */
const searchExportInvoices = async (req, res) => {
    try {
        const userId = req.user._id;
        const Staff = require('../models/Staff');
        const {
            search,
            company, customerName,
            product, productName,
            productGroup,
            fromDate, toDate,
            staffName,
            invoiceNumber,
            minTotal, maxTotal,
            invoiceType,
            currency,
            page = 1, limit = 10, sort = 'createdAt', order = 'desc'
        } = req.query;

        // Safeguard: Ensure userId is valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        // Build query using $and to properly combine userId with other conditions
        const andConditions = [
            { userId: new mongoose.Types.ObjectId(userId) }
        ];

        // 1. Keyword Search ($or) - only if search has value
        if (search && search.trim()) {
            const searchTerm = search.trim();

            // Build $or conditions with existence checks
            const orConditions = [];

            // Always search in company name
            orConditions.push({ 'customerInformation.ms': { $regex: searchTerm, $options: 'i' } });

            // Always search in invoice number
            orConditions.push({ 'invoiceDetails.invoiceNumber': { $regex: searchTerm, $options: 'i' } });

            // Search in documentRemarks only if it exists
            orConditions.push({
                $and: [
                    { documentRemarks: { $exists: true, $ne: null, $ne: '' } },
                    { documentRemarks: { $regex: searchTerm, $options: 'i' } }
                ]
            });

            // Search in items array using $elemMatch
            orConditions.push({
                items: {
                    $elemMatch: {
                        productName: { $regex: searchTerm, $options: 'i' }
                    }
                }
            });

            orConditions.push({
                items: {
                    $elemMatch: {
                        itemNote: { $exists: true, $ne: null, $ne: '' },
                        itemNote: { $regex: searchTerm, $options: 'i' }
                    }
                }
            });

            // Search in export shipping details
            orConditions.push({ 'exportShippingDetails.shipBillNo': { $regex: searchTerm, $options: 'i' } });
            orConditions.push({ 'exportShippingDetails.portOfLoading': { $regex: searchTerm, $options: 'i' } });
            orConditions.push({ 'exportShippingDetails.portOfDischarge': { $regex: searchTerm, $options: 'i' } });

            andConditions.push({ $or: orConditions });
        }

        // 2. Specific Filters
        // Company filter
        if ((company && company.trim()) || (customerName && customerName.trim())) {
            const companyValue = (company || customerName).trim();
            andConditions.push({ 'customerInformation.ms': { $regex: companyValue, $options: 'i' } });
        }

        // Product filter
        if ((product && product.trim()) || (productName && productName.trim())) {
            const productValue = (product || productName).trim();
            andConditions.push({ items: { $elemMatch: { productName: { $regex: productValue, $options: 'i' } } } });
        }

        // Product Group filter
        if (productGroup && productGroup.trim()) {
            andConditions.push({ items: { $elemMatch: { productGroup: { $regex: productGroup.trim(), $options: 'i' } } } });
        }

        // Invoice Number filter
        if (invoiceNumber && invoiceNumber.trim()) {
            const invNo = invoiceNumber.trim();
            andConditions.push({
                $or: [
                    { 'invoiceDetails.invoiceNumber': { $regex: invNo, $options: 'i' } },
                    { 'invoiceDetails.invoicePrefix': { $regex: invNo, $options: 'i' } },
                    { 'invoiceDetails.invoicePostfix': { $regex: invNo, $options: 'i' } }
                ]
            });
        }

        // Invoice Type filter
        if (invoiceType && invoiceType.trim()) {
            andConditions.push({ 'invoiceDetails.invoiceType': invoiceType.trim() });
        }

        // Currency filter
        if (currency && currency.trim()) {
            andConditions.push({ 'currency.code': { $regex: currency.trim(), $options: 'i' } });
        }

        // Date Range
        if (fromDate || toDate) {
            const dateQuery = {};
            if (fromDate) dateQuery.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.$lte = end;
            }
            andConditions.push({ 'invoiceDetails.date': dateQuery });
        }

        // Total Range
        if (minTotal || maxTotal) {
            const totalQuery = {};
            if (minTotal) totalQuery.$gte = Number(minTotal);
            if (maxTotal) totalQuery.$lte = Number(maxTotal);
            andConditions.push({ 'totals.grandTotal': totalQuery });
        }

        // staffName resolution
        if (staffName && staffName.trim()) {
            const staffs = await Staff.find({
                ownerRef: userId,
                fullName: { $regex: staffName.trim(), $options: 'i' }
            }).select('_id');
            if (staffs.length > 0) {
                andConditions.push({ staff: { $in: staffs.map(s => s._id) } });
            }
        }

        // Build final query with $and
        const query = andConditions.length > 1 ? { $and: andConditions } : andConditions[0];

        const totalCount = await ExportInvoice.countDocuments(query);

        // Return "No record found" if no results
        if (totalCount === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No record found'
            });
        }

        const skip = (page - 1) * limit;
        const results = await ExportInvoice.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        res.status(200).json({
            success: true,
            count: results.length,
            total: totalCount,
            page: Number(page),
            pages: Math.ceil(totalCount / limit),
            data: results
        });

    } catch (error) {
        console.error('[Export Invoice Search] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get Export Invoice Summary
 * @route   GET /api/export-invoice/summary
 */
const getExportInvoiceSummary = async (req, res) => {
    try {
        const userId = req.user._id;
        let query = { userId };

        // Apply filters (same pattern as other documents)
        const { company, fromDate, toDate, invoiceType, currency } = req.query;

        if (company) {
            query['customerInformation.ms'] = { $regex: company, $options: 'i' };
        }

        if (invoiceType) {
            query['invoiceDetails.invoiceType'] = invoiceType;
        }

        if (currency) {
            query['currency.code'] = { $regex: currency, $options: 'i' };
        }

        if (fromDate || toDate) {
            query['invoiceDetails.date'] = {};
            if (fromDate) query['invoiceDetails.date'].$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query['invoiceDetails.date'].$lte = end;
            }
        }

        const summary = await getSummaryAggregation(userId, query, ExportInvoice);

        res.status(200).json({
            success: true,
            data: summary
        });
    } catch (error) {
        console.error('[Export Invoice Summary] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createExportInvoice,
    getExportInvoices,
    getExportInvoiceById,
    updateExportInvoice,
    deleteExportInvoice,
    searchExportInvoices,
    getExportInvoiceSummary
};

