const ExportInvoice = require('../../models/Other-Document-Model/Multi-CurrencyExportInvoice');
const User = require('../../models/User-Model/User');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const { calculateExportInvoiceTotals, getSummaryAggregation, getSelectedPrintTemplate } = require('../../utils/documentHelper');
const { calculateShippingDistance } = require('../../utils/shippingHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const mongoose = require('mongoose');
const crypto = require('crypto');
const fs = require('fs');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};

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

        // Relaxed validation for Export Shipping Details to allow draft saving
        /*
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
        */

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
        const Staff = require('../../models/Setting-Model/Staff');
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

/**
 * @desc    Get data for duplicating an Export Invoice (Prefill Add Form)
 * @route   GET /api/export-invoice/:id/duplicate
 */
const getDuplicateExportInvoiceData = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) return res.status(404).json({ success: false, message: 'Export Invoice not found' });

        const data = exportInvoice.toObject();

        // System fields to exclude
        delete data._id;
        delete data.status;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;
        delete data.conversions;
        delete data.attachments;

        // Reset document number
        if (data.invoiceDetails) {
            delete data.invoiceDetails.invoiceNumber;
        }

        // Linked references to exclude
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
            message: 'Export Invoice data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Cancel Export Invoice
 * @route   POST /api/export-invoice/:id/cancel
 */
const cancelExportInvoice = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) return res.status(404).json({ success: false, message: 'Export Invoice not found' });

        if (exportInvoice.status === 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Export Invoice is already cancelled' });
        }

        exportInvoice.status = 'Cancelled';
        const updatedExportInvoice = await exportInvoice.save();

        if (!updatedExportInvoice) {
            return res.status(500).json({ success: false, message: "Failed to update export invoice status" });
        }

        await recordActivity(
            req,
            'Cancel',
            'ExportInvoice',
            `Export Invoice cancelled: ${exportInvoice.invoiceDetails.invoiceNumber}`,
            exportInvoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Export Invoice cancelled successfully", data: updatedExportInvoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Restore Export Invoice
 * @route   POST /api/export-invoice/:id/restore
 */
const restoreExportInvoice = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) return res.status(404).json({ success: false, message: 'Export Invoice not found' });

        if (exportInvoice.status !== 'Cancelled') {
            return res.status(400).json({ success: false, message: 'Export Invoice is not in Cancelled state' });
        }

        exportInvoice.status = 'Active';
        await exportInvoice.save();

        await recordActivity(
            req,
            'Restore',
            'ExportInvoice',
            `Export Invoice restored to Active: ${exportInvoice.invoiceDetails.invoiceNumber}`,
            exportInvoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Export Invoice restored successfully", data: exportInvoice });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Download Export Invoice PDF
 * @route   GET /api/export-invoice/:id/download-pdf
 */
const downloadExportInvoicePDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const exportInvoices = await ExportInvoice.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!exportInvoices || exportInvoices.length === 0) return res.status(404).json({ success: false, message: "Export Invoice(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Multi Currency Export Invoice', exportInvoices[0].branch);
        const pdfBuffer = await generateSaleInvoicePDF(exportInvoices, userData, {
            ...options
        }, 'Multi Currency Export Invoice', printConfig);

        const filename = exportInvoices.length === 1 ? `ExportInvoice_${exportInvoices[0].invoiceDetails.invoiceNumber}.pdf` : `Merged_ExportInvoices.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Export Invoice via Email
 * @route   POST /api/export-invoice/:id/share-email
 */
const shareExportInvoiceEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const exportInvoices = await ExportInvoice.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!exportInvoices || exportInvoices.length === 0) return res.status(404).json({ success: false, message: "Export Invoice(s) not found" });

        const firstDoc = exportInvoices[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || (customer ? customer.email : null);

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);

        await sendInvoiceEmail(exportInvoices, email, false, {
            ...options
        }, 'Multi Currency Export Invoice');

        res.status(200).json({ success: true, message: `Export Invoice(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Export Invoice via WhatsApp
 * @route   POST /api/export-invoice/:id/share-whatsapp
 */
const shareExportInvoiceWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const exportInvoices = await ExportInvoice.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 });
        if (!exportInvoices || exportInvoices.length === 0) return res.status(404).json({ success: false, message: "Export Invoice(s) not found" });

        const firstDoc = exportInvoices[0];
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
        const publicLink = `${req.protocol}://${req.get('host')}/api/export-invoice/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (exportInvoices.length === 1) {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Export Invoice No: ${firstDoc.invoiceDetails.invoiceNumber} for Total Amount: ${firstDoc.currency.symbol} ${firstDoc.totals.grandTotal.toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your merged Export Invoices for Total Amount: ${firstDoc.currency.symbol} ${exportInvoices.reduce((sum, q) => sum + q.totals.grandTotal, 0).toFixed(2)}.\n\nView Link: ${publicLink}\n\nThank you!`;
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

/**
 * @desc    Generate Public Link for Export Invoice
 * @route   GET /api/export-invoice/:id/public-link
 */
const generateExportInvoicePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const exportInvoices = await ExportInvoice.find({ _id: { $in: ids }, userId: req.user._id });
        if (!exportInvoices || exportInvoices.length === 0) return res.status(404).json({ success: false, message: "Export Invoice(s) not found" });

        const token = generatePublicToken(req.params.id);

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/export-invoice/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Public View for Export Invoice
 * @route   GET /api/export-invoice/view-public/:id/:token
 */
const viewPublicExportInvoice = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const exportInvoice = await ExportInvoice.findById(id);
        if (!exportInvoice) return res.status(404).send('Export Invoice not found');

        const userData = await User.findById(exportInvoice.userId);

        const options = getCopyOptions(req);

        const printConfig = await getSelectedPrintTemplate(exportInvoice.userId, 'Multi Currency Export Invoice', exportInvoice.branch);

        const pdfBuffer = await generateSaleInvoicePDF(exportInvoice, userData, {
            ...options
        }, 'Multi Currency Export Invoice', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=export-invoice-${exportInvoice.invoiceDetails.invoiceNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

/**
 * @desc    Attach File to Export Invoice
 * @route   POST /api/export-invoice/:id/attach-file
 */
const attachExportInvoiceFile = async (req, res) => {
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

        const exportInvoice = await ExportInvoice.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { $push: { attachments: { $each: newAttachments } } },
            { new: true }
        );

        if (!exportInvoice) return res.status(404).json({ success: false, message: "Export Invoice not found" });

        await recordActivity(
            req,
            'Attachment',
            'ExportInvoice',
            `Files attached to Export Invoice: ${exportInvoice.invoiceDetails.invoiceNumber}`,
            exportInvoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Files attached successfully", data: exportInvoice.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get All Attachments for Export Invoice
 * @route   GET /api/export-invoice/:id/attachments
 */
const getExportInvoiceAttachments = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) return res.status(404).json({ success: false, message: "Export Invoice not found" });
        res.status(200).json({ success: true, data: exportInvoice.attachments || [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Update/Replace Export Invoice Attachment
 * @route   PUT /api/export-invoice/:id/attachment/:attachmentId
 */
const updateExportInvoiceAttachment = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Export Invoice not found" });
        }

        const attachmentIndex = exportInvoice.attachments.findIndex(a => a._id.toString() === req.params.attachmentId);
        if (attachmentIndex === -1) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(404).json({ success: false, message: "Attachment not found" });
        }

        const oldFile = exportInvoice.attachments[attachmentIndex].filePath;
        if (fs.existsSync(oldFile)) {
            try { fs.unlinkSync(oldFile); } catch (e) { console.error("Error deleting old file:", e); }
        }

        exportInvoice.attachments[attachmentIndex] = {
            _id: exportInvoice.attachments[attachmentIndex]._id,
            fileName: req.file.filename,
            filePath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedAt: new Date(),
            uploadedBy: req.user._id
        };

        await exportInvoice.save();

        await recordActivity(
            req,
            'Update Attachment',
            'ExportInvoice',
            `Attachment replaced for Export Invoice: ${exportInvoice.invoiceDetails.invoiceNumber}`,
            exportInvoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Attachment replaced successfully", data: exportInvoice.attachments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete Export Invoice Attachment
 * @route   DELETE /api/export-invoice/:id/attachment/:attachmentId
 */
const deleteExportInvoiceAttachment = async (req, res) => {
    try {
        const exportInvoice = await ExportInvoice.findOne({ _id: req.params.id, userId: req.user._id });
        if (!exportInvoice) return res.status(404).json({ success: false, message: "Export Invoice not found" });

        const attachment = exportInvoice.attachments.find(a => a._id.toString() === req.params.attachmentId);
        if (!attachment) return res.status(404).json({ success: false, message: "Attachment not found" });

        if (fs.existsSync(attachment.filePath)) {
            try { fs.unlinkSync(attachment.filePath); } catch (e) { console.error("Error deleting file:", e); }
        }

        exportInvoice.attachments = exportInvoice.attachments.filter(a => a._id.toString() !== req.params.attachmentId);
        await exportInvoice.save();

        await recordActivity(
            req,
            'Delete Attachment',
            'ExportInvoice',
            `Attachment deleted from Export Invoice: ${exportInvoice.invoiceDetails.invoiceNumber}`,
            exportInvoice.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Attachment deleted successfully", data: exportInvoice.attachments });
    } catch (error) {
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
    getExportInvoiceSummary,
    getDuplicateExportInvoiceData,
    cancelExportInvoice,
    restoreExportInvoice,
    downloadExportInvoicePDF,
    shareExportInvoiceEmail,
    shareExportInvoiceWhatsApp,
    generateExportInvoicePublicLink,
    viewPublicExportInvoice,
    attachExportInvoiceFile,
    getExportInvoiceAttachments,
    updateExportInvoiceAttachment,
    deleteExportInvoiceAttachment
};

