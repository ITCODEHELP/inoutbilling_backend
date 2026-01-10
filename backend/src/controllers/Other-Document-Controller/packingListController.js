const PackingList = require('../../models/Other-Document-Model/PackingList');
const Staff = require('../../models/Setting-Model/Staff');
const ProductGroup = require('../../models/Product-Service-Model/ProductGroup');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

// Helper to generate and save PDF
const generatePackingListPDFFile = async (packingList) => {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 50 });
            const fileName = `packing_list_${packingList._id}_${Date.now()}.pdf`;
            const uploadDir = path.join(__dirname, '../uploads/packing-lists');

            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const filePath = path.join(uploadDir, fileName);
            const stream = fs.createWriteStream(filePath);
            doc.pipe(stream);

            // PDF Content (Basic structure for demonstration, similar to generateInvoicePDF)
            doc.fontSize(20).text('PACKING LIST', { align: 'center' });
            doc.moveDown();
            doc.fontSize(10).text(`Packing No: ${packingList.packingListDetails.prefix || ''}${packingList.packingListDetails.number}${packingList.packingListDetails.postfix || ''}`);
            doc.text(`Invoice No: ${packingList.packingListDetails.invoiceNumber}`);
            doc.text(`Invoice Date: ${new Date(packingList.packingListDetails.invoiceDate).toLocaleDateString()}`);
            doc.moveDown();
            doc.text(`Customer: ${packingList.customerInformation.ms}`);
            doc.text(`Address: ${packingList.customerInformation.address || ''}`);
            doc.moveDown();

            // Items table
            const tableTop = 250;
            doc.text('Pkg No', 50, tableTop);
            doc.text('Product Description', 100, tableTop);
            doc.text('Qty', 300, tableTop);
            doc.text('Gross Wt', 350, tableTop);
            doc.text('Net Wt', 450, tableTop);
            doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

            let y = tableTop + 25;
            packingList.items.forEach(item => {
                doc.text(item.pkgNo || '', 50, y);
                doc.text(item.productDescription, 100, y, { width: 180 });
                doc.text(item.qty.toString(), 300, y);
                doc.text(item.grossWeight.toString(), 350, y);
                doc.text(item.netWeight.toString(), 450, y);
                y += 20;
            });

            doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
            y += 20;
            doc.text(`Total Packages: ${packingList.totals.totalPackages}`, 350, y);
            y += 15;
            doc.text(`Total Gross Wt: ${packingList.totals.totalGrossWeight}`, 350, y);
            y += 15;
            doc.text(`Total Net Wt: ${packingList.totals.totalNetWeight}`, 350, y);

            doc.end();
            stream.on('finish', () => resolve(`/uploads/packing-lists/${fileName}`));
            stream.on('error', reject);
        } catch (error) {
            reject(error);
        }
    });
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
            const pdfUrl = await generatePackingListPDFFile(packingList);
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

        // Update fields
        Object.assign(packingList, data);
        packingList.updatedBy = req.user._id;

        if (saveAndPrint) {
            const pdfUrl = await generatePackingListPDFFile(packingList);
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

module.exports = {
    createPackingList,
    getPackingLists,
    getPackingListById,
    updatePackingList,
    deletePackingList,
    downloadPackingList
};
