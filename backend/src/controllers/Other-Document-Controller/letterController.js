const Letter = require('../../models/Other-Document-Model/Letter');
const Staff = require('../../models/Setting-Model/Staff');
const Customer = require('../../models/Customer-Vendor-Model/Customer');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Product = require('../../models/Product-Service-Model/Product');
const mongoose = require('mongoose');

/**
 * @desc    Create a new letter
 * @route   POST /api/letters
 * @access  Private
 */
const createLetter = async (req, res) => {
    try {
        const { title, letterNumber, letterDate, templateType, letterBody, staff, blocks } = req.body;

        const letter = new Letter({
            userId: req.user._id,
            title,
            letterNumber,
            letterDate,
            templateType,
            letterBody: letterBody || "",
            staff,
            blocks: blocks || []
        });

        await letter.save();

        res.status(201).json({
            success: true,
            message: 'Letter created successfully',
            data: letter
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get all letters for logged in user
 * @route   GET /api/letters
 * @access  Private
 */
const getLetters = async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
        const skip = (page - 1) * limit;

        const query = {
            userId: req.user._id,
            isDeleted: false
        };

        const letters = await Letter.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        const total = await Letter.countDocuments(query);

        res.status(200).json({
            success: true,
            count: letters.length,
            total,
            page: Number(page),
            pages: Math.ceil(total / limit),
            data: letters
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Get single letter by ID
 * @route   GET /api/letters/:id
 * @access  Private
 */
const getLetterById = async (req, res) => {
    try {
        const letter = await Letter.findOne({
            _id: req.params.id,
            userId: req.user._id,
            isDeleted: false
        });

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        res.status(200).json({
            success: true,
            data: letter
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Update letter with revalidation
 * @route   PUT /api/letters/:id
 * @access  Private
 */
const updateLetter = async (req, res) => {
    try {
        const { title, letterNumber, letterDate, templateType, letterBody, staff, blocks } = req.body;

        const letter = await Letter.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, isDeleted: false },
            { title, letterNumber, letterDate, templateType, letterBody, staff, blocks },
            { new: true, runValidators: true }
        );

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Letter updated successfully',
            data: letter
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Delete letter (soft delete)
 * @route   DELETE /api/letters/:id
 * @access  Private
 */
const deleteLetter = async (req, res) => {
    try {
        const letter = await Letter.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, isDeleted: false },
            { isDeleted: true },
            { new: true }
        );

        if (!letter) {
            return res.status(404).json({
                success: false,
                message: 'Letter not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Letter deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * @desc    Search letters with filters
 * @route   GET /api/letters/search
 * @access  Private
 */
const searchLetters = async (req, res) => {
    try {
        const {
            letterNo,
            fromDate, toDate,
            title,
            staffName,
            page = 1, limit = 10, sort = 'createdAt', order = 'desc'
        } = req.query;

        let query = {
            userId: req.user._id,
            isDeleted: false
        };

        if (title) {
            query.title = { $regex: title, $options: 'i' };
        }

        if (fromDate || toDate) {
            query.letterDate = {};
            if (fromDate) query.letterDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.letterDate.$lte = end;
            }
        }

        if (staffName) {
            const staffs = await Staff.find({
                ownerRef: req.user._id,
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');
            query.staff = { $in: staffs.map(s => s._id) };
        }

        if (letterNo) {
            query.$or = [
                { 'letterNumber.number': { $regex: letterNo, $options: 'i' } },
                { 'letterNumber.prefix': { $regex: letterNo, $options: 'i' } },
                { 'letterNumber.postfix': { $regex: letterNo, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;
        const results = await Letter.find(query)
            .sort({ [sort]: order === 'desc' ? -1 : 1 })
            .skip(Number(skip))
            .limit(Number(limit))
            .populate('staff', 'fullName');

        const totalCount = await Letter.countDocuments(query);

        if (totalCount === 0) {
            return res.status(200).json({
                success: true,
                message: 'No record found',
                data: [],
                count: 0,
                pagination: {
                    total: 0,
                    page: Number(page),
                    limit: Number(limit),
                    pages: 0
                }
            });
        }

        res.status(200).json({
            success: true,
            data: results,
            pagination: {
                total: totalCount,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(totalCount / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/* -------------------- BLOCK OPERATIONS -------------------- */

/**
 * @desc    Move a block up or down
 * @route   PATCH /api/letters/:id/blocks/:blockId/move
 * @access  Private
 */
const moveLetterBlock = async (req, res) => {
    try {
        const { direction } = req.body; // 'up' or 'down'
        const { id, blockId } = req.params;

        const letter = await Letter.findOne({ _id: id, userId: req.user._id, isDeleted: false });
        if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

        const index = letter.blocks.findIndex(b => b.id === blockId);
        if (index === -1) return res.status(404).json({ success: false, message: 'Block not found' });

        if (direction === 'up' && index > 0) {
            [letter.blocks[index], letter.blocks[index - 1]] = [letter.blocks[index - 1], letter.blocks[index]];
        } else if (direction === 'down' && index < letter.blocks.length - 1) {
            [letter.blocks[index], letter.blocks[index + 1]] = [letter.blocks[index + 1], letter.blocks[index]];
        }

        await letter.save();
        res.status(200).json({ success: true, data: letter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Delete a specific block
 * @route   DELETE /api/letters/:id/blocks/:blockId
 * @access  Private
 */
const deleteLetterBlock = async (req, res) => {
    try {
        const { id, blockId } = req.params;

        const letter = await Letter.findOneAndUpdate(
            { _id: id, userId: req.user._id, isDeleted: false },
            { $pull: { blocks: { id: blockId } } },
            { new: true }
        );

        if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

        res.status(200).json({ success: true, message: 'Block deleted successfully', data: letter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/* -------------------- ENTITY SELECTION -------------------- */

/**
 * @desc    Get all customers (ID and Company Name only)
 * @route   GET /api/letters/entities/customers
 * @access  Private
 */
const getLetterCustomers = async (req, res) => {
    try {
        console.log('[LetterBuilder] GET /entities/customers - userId:', req.user?._id);
        const customers = await Customer.find({ userId: req.user._id })
            .select('_id companyName')
            .sort({ companyName: 1 });
        console.log(`[LetterBuilder] Found ${customers.length} customers`);
        res.status(200).json({ success: true, data: customers });
    } catch (error) {
        console.error('[LetterBuilder] Error in getLetterCustomers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all vendors (ID and Company Name only)
 * @route   GET /api/letters/entities/vendors
 * @access  Private
 */
const getLetterVendors = async (req, res) => {
    try {
        console.log('[LetterBuilder] GET /entities/vendors - userId:', req.user?._id);
        const vendors = await Vendor.find({ userId: req.user._id })
            .select('_id companyName')
            .sort({ companyName: 1 });
        console.log(`[LetterBuilder] Found ${vendors.length} vendors`);
        res.status(200).json({ success: true, data: vendors });
    } catch (error) {
        console.error('[LetterBuilder] Error in getLetterVendors:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all entities (Customers & Vendors combined)
 * @route   GET /api/letters/entities/all
 * @access  Private
 */
const getLetterAllEntities = async (req, res) => {
    try {
        console.log('[LetterBuilder] GET /entities/all - userId:', req.user?._id);
        const customers = await Customer.find({ userId: req.user._id })
            .select('_id companyName')
            .lean();
        const vendors = await Vendor.find({ userId: req.user._id })
            .select('_id companyName')
            .lean();

        const combined = [
            ...customers.map(c => ({ ...c, entityType: 'customer' })),
            ...vendors.map(v => ({ ...v, entityType: 'vendor' }))
        ].sort((a, b) => (a.companyName || '').localeCompare(b.companyName || ''));

        console.log(`[LetterBuilder] Combined result count: ${combined.length}`);
        res.status(200).json({ success: true, data: combined });
    } catch (error) {
        console.error('[LetterBuilder] Error in getLetterAllEntities:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Get all products/services (with search, pagination, filter)
 * @route   GET /api/letters/entities/products
 * @access  Private
 */
const getLetterProducts = async (req, res) => {
    try {
        const { search, type, page = 1, limit = 10 } = req.query;
        console.log('[LetterBuilder] GET /entities/products - userId:', req.user?._id, { search, type, page, limit });

        const query = { userId: req.user._id, status: 'Active' };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { barcodeNumber: { $regex: search, $options: 'i' } },
                { hsnSac: { $regex: search, $options: 'i' } }
            ];
        }

        if (type) {
            query.itemType = type;
        }

        const skip = (page - 1) * limit;

        const products = await Product.find(query)
            .select('_id name itemType barcodeNumber productNote unitOfMeasurement sellPrice taxSelection status hsnSac saleDiscount availableQuantity')
            .sort({ name: 1 })
            .skip(Number(skip))
            .limit(Number(limit));

        const total = await Product.countDocuments(query);

        console.log(`[LetterBuilder] Found ${products.length} products`);

        res.status(200).json({
            success: true,
            data: products,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('[LetterBuilder] Error in getLetterProducts:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Resolve entity/product details for blocks
 * @route   POST /api/letters/resolve-content
 * @access  Private
 */
const resolveBlockContent = async (req, res) => {
    try {
        const { type, id, ids, entityType } = req.body;
        let data = null;

        if (type === 'entitySelector') {
            if (entityType === 'customer') {
                data = await Customer.findOne({ _id: id, userId: req.user._id });
            } else if (entityType === 'vendor') {
                data = await Vendor.findOne({ _id: id, userId: req.user._id });
            } else {
                // Fallback for backward compatibility or if type not specified
                data = await Customer.findOne({ _id: id, userId: req.user._id });
                if (!data) {
                    data = await Vendor.findOne({ _id: id, userId: req.user._id });
                }
            }
        } else if (type === 'productSelector') {
            console.log(`[LetterBuilder] Resolving product ID: ${id}`);
            data = await Product.findOne({ _id: id, userId: req.user._id });
        } else if (type === 'multiProductSelector') {
            console.log(`[LetterBuilder] Resolving multiple products IDs: ${ids}`);
            data = await Product.find({ _id: { $in: ids }, userId: req.user._id });
        }

        if (!data) {
            console.warn(`[LetterBuilder] Resolution failed for type: ${type}, id: ${id || ids}`);
            return res.status(404).json({ success: false, message: 'Entity or Product not found' });
        }

        console.log(`[LetterBuilder] Successfully resolved ${type}`);
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('[LetterBuilder] Error in resolveBlockContent:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createLetter,
    getLetters,
    getLetterById,
    updateLetter,
    deleteLetter,
    searchLetters,
    moveLetterBlock,
    deleteLetterBlock,
    resolveBlockContent,
    getLetterCustomers,
    getLetterVendors,
    getLetterAllEntities,
    getLetterProducts
};
