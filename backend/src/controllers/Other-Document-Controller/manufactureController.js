const Manufacture = require('../../models/Other-Document-Model/Manufacture');
const Product = require('../../models/Product-Service-Model/Product');
const numberToWords = require('../../utils/numberToWords');

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

module.exports = {
    createManufacture,
    getManufactures,
    getManufactureById,
    updateManufacture,
    searchManufactures
};
