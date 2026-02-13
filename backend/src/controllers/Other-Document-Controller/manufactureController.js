const Manufacture = require('../../models/Other-Document-Model/Manufacture');
const Product = require('../../models/Product-Service-Model/Product');
const User = require('../../models/User-Model/User');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getSelectedPrintTemplate, getSummaryAggregation } = require('../../utils/documentHelper');
const numberToWords = require('../../utils/numberToWords');
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

// Helper to calculate all totals
const calculateManufactureTotals = (data) => {
    let rawMaterialTotal = 0;
    let otherOutcomeTotal = 0;

    // Calculate Raw Materials
    if (data.rawMaterials && data.rawMaterials.length > 0) {
        data.rawMaterials.forEach(item => {
            item.total = (item.qty || 0) * (item.price || 0);
            rawMaterialTotal += item.total;
        });
    }

    // Calculate Other Outcomes
    if (data.otherOutcomes && data.otherOutcomes.length > 0) {
        data.otherOutcomes.forEach(item => {
            item.total = (item.qty || 0) * (item.price || 0);
            otherOutcomeTotal += item.total;
        });
    }

    let subTotal = rawMaterialTotal + otherOutcomeTotal;
    let adjustmentAmount = 0;

    if (data.adjustment) {
        const adjVal = Number(data.adjustment.value) || 0;
        if (data.adjustment.type === '%') {
            adjustmentAmount = (subTotal * adjVal) / 100;
        } else {
            adjustmentAmount = adjVal;
        }

        if (data.adjustment.sign === '-') {
            adjustmentAmount = -Math.abs(adjustmentAmount);
        } else {
            adjustmentAmount = Math.abs(adjustmentAmount);
        }
    }

    const grandTotal = Math.max(0, subTotal + adjustmentAmount);
    const quantity = Number(data.quantity) || 1;
    const unitPrice = grandTotal / quantity;

    return {
        rawMaterials: data.rawMaterials,
        otherOutcomes: data.otherOutcomes,
        rawMaterialTotal,
        otherOutcomeTotal,
        grandTotal,
        unitPrice,
        totalInWords: numberToWords(grandTotal)
    };
};

/**
 * @desc    Create a new Manufacture entry
 * @route   POST /api/manufacture
 */
const createManufacture = async (req, res) => {
    try {
        const calculations = calculateManufactureTotals(req.body);

        const manufacture = new Manufacture({
            ...req.body,
            ...calculations,
            userId: req.user._id
        });

        await manufacture.save();

        res.status(201).json({
            success: true,
            message: 'Manufacture entry created successfully',
            data: manufacture
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get all manufactures for owner
 * @route   GET /api/manufacture
 */
const getManufactures = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id, isDeleted: false };
        const total = await Manufacture.countDocuments(query);

        const results = await Manufacture.find(query)
            .populate('product', 'name')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get single Manufacture by ID
 * @route   GET /api/manufacture/:id
 */
const getManufactureById = async (req, res) => {
    try {
        const manufacture = await Manufacture.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        }).populate('product', 'name');

        if (!manufacture) {
            return res.status(404).json({
                success: false,
                message: 'Manufacture record not found'
            });
        }

        res.status(200).json({
            success: true,
            data: manufacture
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Update Manufacture entry
 * @route   PUT /api/manufacture/:id
 */
const updateManufacture = async (req, res) => {
    try {
        const calculations = calculateManufactureTotals(req.body);

        const manufacture = await Manufacture.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, isDeleted: false },
            { ...req.body, ...calculations },
            { new: true, runValidators: true }
        );

        if (!manufacture) {
            return res.status(404).json({
                success: false,
                message: 'Manufacture record not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Manufacture record updated successfully',
            data: manufacture
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Search Manufacture documents by product name in arrays
 * @route   GET /api/manufacture/search
 */
const searchManufactures = async (req, res) => {
    try {
        const { productName, fromDate, toDate, page = 1, limit = 10 } = req.query;

        // Build base query
        let query = {
            userId: req.user._id,
            isDeleted: false
        };

        // Add product name filter - search in rawMaterials and otherOutcomes arrays
        if (productName) {
            query.$or = [
                { 'rawMaterials.productName': { $regex: productName, $options: 'i' } },
                { 'otherOutcomes.productName': { $regex: productName, $options: 'i' } }
            ];
        }

        // Add date range filter
        if (fromDate || toDate) {
            query.manufactureDate = {};
            if (fromDate) {
                query.manufactureDate.$gte = new Date(fromDate);
            }
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.manufactureDate.$lte = end;
            }
        }

        // Count total matching documents
        const total = await Manufacture.countDocuments(query);

        // Return empty result if no records found
        if (total === 0) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No record found'
            });
        }

        // Execute query with pagination
        const skip = (page - 1) * limit;
        const results = await Manufacture.find(query)
            .populate('product', 'name')
            .sort({ createdAt: -1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: results
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Delete Manufacture record
 * @route   DELETE /api/manufacture/:id
 */
const deleteManufacture = async (req, res) => {
    try {
        const manufacture = await Manufacture.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        });

        if (!manufacture) {
            return res.status(404).json({
                success: false,
                message: 'Manufacture not found'
            });
        }

        await Manufacture.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Manufacture deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




const prepareManufactureForPdf = (manufactures) => {
    return manufactures.map(doc => {
        const obj = doc.toObject();
        // Map to invoiceDetails for PDF generator compatibility
        obj.invoiceDetails = {
            invoiceNumber: doc.manufactureNumber,
            invoiceDate: doc.manufactureDate
        };

        // Add Product Details for Header
        const productName = doc.product && doc.product.name ? doc.product.name : 'N/A';
        const qty = doc.quantity || 0;
        const uom = doc.uom || '';

        obj.productDetails = {
            productName,
            qty,
            uom,
            description: `${productName} - ${qty} ${uom}`
        };

        // Map rawMaterials and otherOutcomes to generic items array
        const rawMaterials = (doc.rawMaterials || []).map(i => ({
            productName: i.productName,
            description: i.itemNote || '', // Separating note
            qty: i.qty,
            uom: i.uom,
            rate: i.price,
            price: i.price,
            total: i.total,
            hsnSac: '',
            discount: 0,
            igst: 0, cgst: 0, sgst: 0
        }));

        const otherOutcomes = (doc.otherOutcomes || []).map(i => ({
            productName: i.productName, // Treating as "Particulars"
            description: i.itemNote || 'Other Outcome',
            qty: i.qty,
            uom: i.uom, // Ensure UOM is passed
            rate: i.price,
            price: i.price,
            total: i.total,
            hsnSac: '',
            discount: 0,
            igst: 0, cgst: 0, sgst: 0
        }));

        obj.mappedRawMaterials = rawMaterials;
        obj.mappedOtherOutcomes = otherOutcomes;
        obj.items = [...rawMaterials, ...otherOutcomes];

        // Ensure totals structure is present if needed by PDF helper
        if (!obj.totals) {
            obj.totals = {
                grandTotal: doc.grandTotal,
                totalInWords: doc.totalInWords
            };
        }

        return obj;
    });
};

const downloadManufacturePDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const manufactures = await Manufacture.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 }).populate('product', 'name');
        if (!manufactures || manufactures.length === 0) return res.status(404).json({ success: false, message: "Manufacture record(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);

        // Pass overrides for labels
        const pdfOptions = {
            ...options,
            numLabel: 'Manufacture No.',
            dateLabel: 'Manufacture Date',
            hideDueDate: true,
            hideTerms: true
        };

        const mappedManufactures = prepareManufactureForPdf(manufactures);

        // Manufacture doesn't strictly have a "Branch" usually, using default if not present
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Manufacture');

        const pdfBuffer = await generateSaleInvoicePDF(mappedManufactures, userData, pdfOptions, 'Manufacture', printConfig);

        const filename = manufactures.length === 1 ? `Manufacture_${manufactures[0].manufactureNumber}.pdf` : `Merged_Manufacture_Docs.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareManufactureEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const manufactures = await Manufacture.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 }).populate('product', 'name');
        if (!manufactures || manufactures.length === 0) return res.status(404).json({ success: false, message: "Manufacture record(s) not found" });

        const email = req.body.email; // Required as no customer link
        if (!email) return res.status(400).json({ success: false, message: "Email address is required." });

        const options = getCopyOptions(req);
        const pdfOptions = {
            ...options,
            numLabel: 'Manufacture No.',
            dateLabel: 'Manufacture Date',
            hideDueDate: true,
            hideTerms: true
        };

        const mappedManufactures = prepareManufactureForPdf(manufactures);

        await sendInvoiceEmail(mappedManufactures, email, false, pdfOptions, 'Manufacture');

        res.status(200).json({ success: true, message: `Manufacture document(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const shareManufactureWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const manufactures = await Manufacture.find({ _id: { $in: ids }, userId: req.user._id }).sort({ createdAt: 1 }).populate('product', 'name');
        if (!manufactures || manufactures.length === 0) return res.status(404).json({ success: false, message: "Manufacture record(s) not found" });

        const firstDoc = manufactures[0];
        const phone = req.body.phone; // Required

        if (!phone) return res.status(400).json({ success: false, message: "Phone number is required." });

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
        const publicLink = `${req.protocol}://${req.get('host')}/api/manufacture/view-public/${req.params.id}/${token}${queryString}`;

        let message = '';
        if (manufactures.length === 1) {
            message = `Please find Manufacture Document No: ${firstDoc.manufactureNumber} for Product: ${firstDoc.product ? firstDoc.product.name : 'N/A'}.\n\nView Link: ${publicLink}\n\nThank you!`;
        } else {
            message = `Please find merged Manufacture Documents.\n\nView Link: ${publicLink}\n\nThank you!`;
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

const generateManufacturePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const manufactures = await Manufacture.find({ _id: { $in: ids }, userId: req.user._id });
        if (!manufactures || manufactures.length === 0) return res.status(404).json({ success: false, message: "Manufacture record(s) not found" });

        const token = generatePublicToken(req.params.id);

        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/manufacture/view-public/${req.params.id}/${token}${queryString}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const viewPublicManufacture = async (req, res) => {
    try {
        const { id, token } = req.params;
        const generatedToken = generatePublicToken(id);

        if (token !== generatedToken) {
            return res.status(403).send('Invalid or expired link');
        }

        const manufacture = await Manufacture.findById(id).populate('product', 'name');
        if (!manufacture) return res.status(404).send('Manufacture record not found');

        const userData = await User.findById(manufacture.userId);

        const options = getCopyOptions(req);
        const pdfOptions = {
            ...options,
            numLabel: 'Manufacture No.',
            dateLabel: 'Manufacture Date',
            hideDueDate: true,
            hideTerms: true
        };

        const printConfig = await getSelectedPrintTemplate(manufacture.userId, 'Manufacture');
        const mappedManufactures = prepareManufactureForPdf([manufacture]);

        const pdfBuffer = await generateSaleInvoicePDF(mappedManufactures, userData, pdfOptions, 'Manufacture', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=manufacture-${manufacture.manufactureNumber}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    createManufacture,
    getManufactures,
    getManufactureById,
    updateManufacture,
    searchManufactures,
    deleteManufacture,
    downloadManufacturePDF,
    shareManufactureEmail,
    shareManufactureWhatsApp,
    generateManufacturePublicLink,
    viewPublicManufacture
};

