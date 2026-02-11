const PackingList = require('../../models/Other-Document-Model/PackingList');
const Staff = require('../../models/Setting-Model/Staff');
const ProductGroup = require('../../models/Product-Service-Model/ProductGroup');
const User = require('../../models/User-Model/User');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const mongoose = require('mongoose');
const { getSelectedPrintTemplate } = require('../../utils/documentHelper');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { getCopyOptions } = require('../../utils/pdfHelper');
const { sendInvoiceEmail } = require('../../utils/emailHelper');

// Helper to generate secure public token
const generatePublicToken = (id) => {
    const secret = process.env.JWT_SECRET || 'your-default-secret';
    return crypto
        .createHmac('sha256', secret)
        .update(id.toString())
        .digest('hex')
        .substring(0, 16);
};

// Helper to generate and save PDF
// Helper to generate and save PDF using the standard Sale Invoice template
const generatePackingListPDFFile = async (packingList, userId) => {
    try {
        const user = await User.findById(userId);
        const options = { original: true };
        const printConfig = await getSelectedPrintTemplate(userId, 'Packing List', packingList.branch);
        const pdfBuffer = await generateSaleInvoicePDF(packingList, user, options, 'Packing List', printConfig);

        const fileName = `packing_list_${packingList._id}_${Date.now()}.pdf`;
        const uploadDir = path.join(__dirname, '../../uploads/packing-lists'); // Adjusted path

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, pdfBuffer);

        return `/uploads/packing-lists/${fileName}`;
    } catch (error) {
        throw error;
    }
};

/**
 * @desc    Print Packing List
 * @route   GET /api/packing-list/:id/print
 */
const printPackingList = async (req, res) => {
    try {
        const packingList = await PackingList.findOne({ _id: req.params.id, userId: req.user._id, isDeleted: false });
        if (!packingList) return res.status(404).json({ success: false, message: 'Packing List not found' });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const printConfig = await getSelectedPrintTemplate(req.user._id, 'Packing List', packingList.branch);
        const pdfBuffer = await generateSaleInvoicePDF(packingList, userData, options, 'Packing List', printConfig);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="PackingList.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Download Packing List PDF (Support Multiple)
 * @route   GET /api/packing-list/:id/download-pdf
 */
const downloadPackingListPDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim());
        const packingLists = await PackingList.find({ _id: { $in: ids }, userId: req.user._id, isDeleted: false }).sort({ createdAt: 1 });
        if (!packingLists || packingLists.length === 0) return res.status(404).json({ success: false, message: "Packing List(s) not found" });

        const userData = await User.findById(req.user._id);
        const options = getCopyOptions(req);
        const pdfBuffer = await generateSaleInvoicePDF(packingLists, userData, options, 'Packing List');

        const filename = packingLists.length === 1 ? `PackingList_${packingLists[0].packingListDetails.number}.pdf` : `Merged_PackingLists.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Packing List via Email
 * @route   POST /api/packing-list/:id/share-email
 */
const sharePackingListEmail = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim());
        const packingLists = await PackingList.find({ _id: { $in: ids }, userId: req.user._id, isDeleted: false }).sort({ createdAt: 1 });

        if (packingLists.length === 0) return res.status(404).json({ success: false, message: "Packing List(s) not found" });

        const firstDoc = packingLists[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const email = req.body.email || customer?.email;

        if (!email) return res.status(400).json({ success: false, message: "Customer email not found. Please provide an email address." });

        const options = getCopyOptions(req);
        await sendInvoiceEmail(packingLists, email, false, options, 'Packing List');
        res.status(200).json({ success: true, message: `Packing List(s) sent to ${email} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Packing List via WhatsApp
 * @route   POST /api/packing-list/:id/share-whatsapp
 */
const sharePackingListWhatsApp = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim());
        const packingLists = await PackingList.find({ _id: { $in: ids }, userId: req.user._id, isDeleted: false }).sort({ createdAt: 1 });
        if (packingLists.length === 0) return res.status(404).json({ success: false, message: "Packing List(s) not found" });

        const firstDoc = packingLists[0];
        const customer = await Customer.findOne({ userId: req.user._id, companyName: firstDoc.customerInformation.ms });
        const phone = req.body.phone || customer?.phone;

        if (!phone) return res.status(400).json({ success: false, message: "Customer phone not found. Please provide a phone number." });

        const cleanPhone = phone.replace(/\D/g, '');
        const whatsappNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const publicLink = `${req.protocol}://${req.get('host')}/api/packing-list/view-public/${req.params.id}/${token}${queryString}`;

        const docNum = firstDoc.packingListDetails.prefix + firstDoc.packingListDetails.number + (firstDoc.packingListDetails.postfix || '');
        const message = `Dear ${firstDoc.customerInformation.ms},\n\nPlease find your Packing List No: ${docNum}.\n\nView Link: ${publicLink}\n\nThank you!`;
        const encodedMessage = encodeURIComponent(message);
        const deepLink = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;

        res.status(200).json({ success: true, message: "WhatsApp share link generated", data: { whatsappNumber, deepLink } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Generate Secure Public Link for Packing List
 * @route   GET /api/packing-list/:id/public-link
 */
const generatePackingListPublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',').map(id => id.trim());
        const packingLists = await PackingList.find({ _id: { $in: ids }, userId: req.user._id, isDeleted: false }).sort({ createdAt: 1 });
        if (packingLists.length === 0) return res.status(404).json({ success: false, message: "Packing List(s) not found" });

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');
        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';

        const publicLink = `${req.protocol}://${req.get('host')}/api/packing-list/view-public/${req.params.id}/${token}${queryString}`;
        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    View Packing List Publicly (Render PDF)
 * @route   GET /api/packing-list/view-public/:id/:token
 */
const viewPackingListPublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        if (token !== generatePublicToken(id)) return res.status(401).send("Invalid or expired link");

        const ids = id.split(',').map(id => id.trim());
        const packingLists = await PackingList.find({ _id: { $in: ids }, isDeleted: false }).sort({ createdAt: 1 });
        if (!packingLists || packingLists.length === 0) return res.status(404).send("Packing List(s) not found");

        const userData = await User.findById(packingLists[0].userId);
        const options = getCopyOptions(req);
        const pdfBuffer = await generateSaleInvoicePDF(packingLists, userData || {}, options, 'Packing List');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="PackingList.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering PDF");
    }
};

/**
 * @desc    Create a new Packing List
 * @route   POST /api/packing-list
 */
const createPackingList = async (req, res) => {
    try {
        const { saveAndPrint, ...data } = req.body;

        const packingList = new PackingList({
            ...data,
            userId: req.user._id,
            createdBy: req.user._id,
            updatedBy: req.user._id
        });

        if (saveAndPrint) {
            const pdfUrl = await generatePackingListPDFFile(packingList, req.user._id);
            packingList.pdfUrl = pdfUrl;
        }

        await packingList.save();

        res.status(201).json({
            success: true,
            message: 'Packing List created successfully',
            data: packingList
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get Packing Lists with advanced search
 * @route   GET /api/packing-list
 */
const getPackingLists = async (req, res) => {
    try {
        const {
            page = 1, limit = 10, sort = 'createdAt', order = 'desc',
            company, product, productGroup, fromDate, toDate,
            staffName, invoiceNo, challanNo, itemNote, remarks,
            gstin, invoiceType, shippingAddressSearch
        } = req.query;

        let query = { userId: req.user._id, isDeleted: false };

        if (company) query['customerInformation.ms'] = { $regex: company, $options: 'i' };
        if (product) query['items.productDescription'] = { $regex: product, $options: 'i' };
        if (productGroup) query['items.productGroup'] = { $regex: productGroup, $options: 'i' };
        if (invoiceNo) query['packingListDetails.invoiceNumber'] = { $regex: invoiceNo, $options: 'i' };
        if (challanNo) query['packingListDetails.challanNo'] = { $regex: challanNo, $options: 'i' };
        if (itemNote) query['items.itemNote'] = { $regex: itemNote, $options: 'i' };
        if (remarks) query.remarks = { $regex: remarks, $options: 'i' };
        if (gstin) query['customerInformation.gstinPan'] = { $regex: gstin, $options: 'i' };
        if (invoiceType) query['packingListDetails.invoiceType'] = invoiceType;

        if (shippingAddressSearch) {
            query.$or = [
                { 'shippingAddress.street': { $regex: shippingAddressSearch, $options: 'i' } },
                { 'shippingAddress.city': { $regex: shippingAddressSearch, $options: 'i' } },
                { 'shippingAddress.state': { $regex: shippingAddressSearch, $options: 'i' } }
            ];
        }

        if (fromDate || toDate) {
            query['packingListDetails.invoiceDate'] = {};
            if (fromDate) query['packingListDetails.invoiceDate'].$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query['packingListDetails.invoiceDate'].$lte = end;
            }
        }

        if (staffName) {
            const staffs = await Staff.find({
                ownerRef: req.user._id,
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');
            query.staff = { $in: staffs.map(s => s._id) };
        }

        const skip = (page - 1) * limit;
        const total = await PackingList.countDocuments(query);

        if (total === 0) {
            return res.status(200).json({
                success: true,
                message: 'No record found',
                data: [],
                count: 0
            });
        }

        const packingLists = await PackingList.find(query)
            .populate('staff', 'fullName')
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        res.status(200).json({
            success: true,
            count: packingLists.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: packingLists
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get single Packing List by ID
 * @route   GET /api/packing-list/:id
 */
const getPackingListById = async (req, res) => {
    try {
        const packingList = await PackingList.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        }).populate('staff', 'fullName');

        if (!packingList) {
            return res.status(404).json({
                success: false,
                message: 'Packing List not found'
            });
        }

        res.status(200).json({
            success: true,
            data: packingList
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Update Packing List
 * @route   PUT /api/packing-list/:id
 */
const deepMerge = (target, source) => {
    for (const key in source) {
        if (source[key] instanceof Date) {
            target[key] = new Date(source[key]);
        } else if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
};

/**
 * @desc    Update Packing List
 * @route   PUT /api/packing-list/:id
 */
const updatePackingList = async (req, res) => {
    try {
        const { saveAndPrint, ...data } = req.body;

        let packingList = await PackingList.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        });

        if (!packingList) {
            return res.status(404).json({
                success: false,
                message: 'Packing List not found'
            });
        }

        // Deep merge updates
        deepMerge(packingList, data);

        // Explicitly mark modified paths for mixed types if any, though deepMerge sets properties directly
        // Mongoose sometimes needs markModified for Mixed types, but direct assignment to schema paths usually triggers setters.
        // Array replacement (if items are sent) works via deepMerge else clause (arrays are treated as values).

        packingList.updatedBy = req.user._id;

        if (saveAndPrint) {
            const pdfUrl = await generatePackingListPDFFile(packingList, req.user._id);
            packingList.pdfUrl = pdfUrl;
        }

        await packingList.save();

        res.status(200).json({
            success: true,
            message: 'Packing List updated successfully',
            data: packingList
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Delete Packing List (Soft Delete)
 * @route   DELETE /api/packing-list/:id
 */
const deletePackingList = async (req, res) => {
    try {
        const packingList = await PackingList.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, isDeleted: false },
            { isDeleted: true, updatedBy: req.user._id },
            { new: true }
        );

        if (!packingList) {
            return res.status(404).json({
                success: false,
                message: 'Packing List not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Packing List deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Download Packing List PDF
 * @route   GET /api/packing-list/:id/download
 */
const downloadPackingList = async (req, res) => {
    try {
        const packingList = await PackingList.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        });

        if (!packingList || !packingList.pdfUrl) {
            return res.status(404).json({
                success: false,
                message: 'PDF not found'
            });
        }

        const filePath = path.join(__dirname, '..', packingList.pdfUrl);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'File does not exist on server'
            });
        }

        res.download(filePath);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get data for duplicating a Packing List (Prefill Add Form)
 * @route   GET /api/packing-list/:id/duplicate
 */
const getDuplicatePackingListData = async (req, res) => {
    try {
        const packingList = await PackingList.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        });

        if (!packingList) {
            return res.status(404).json({
                success: false,
                message: 'Packing List not found'
            });
        }

        const data = packingList.toObject();

        // System fields to exclude
        delete data._id;
        delete data.createdAt;
        delete data.updatedAt;
        delete data.__v;
        delete data.userId;
        delete data.pdfUrl;
        delete data.isDeleted;
        delete data.createdBy;
        delete data.updatedBy;

        // Reset document number
        if (data.packingListDetails) {
            delete data.packingListDetails.number;
        }

        // Reset sub-document IDs
        if (Array.isArray(data.items)) {
            data.items = data.items.map(item => {
                delete item._id;
                return item;
            });
        }

        res.status(200).json({
            success: true,
            message: 'Packing List data for duplication retrieved',
            data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createPackingList,
    getPackingLists,
    getPackingListById,
    updatePackingList,
    deletePackingList,
    downloadPackingList,
    getDuplicatePackingListData,
    printPackingList,
    downloadPackingListPDF,
    sharePackingListEmail,
    sharePackingListWhatsApp,
    generatePackingListPublicLink,
    viewPackingListPublic
};
