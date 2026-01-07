const Letter = require('../models/Letter');
const Staff = require('../models/Staff');

/**
 * @desc    Create a new letter
 * @route   POST /api/letters
 * @access  Private
 */
const createLetter = async (req, res) => {
    try {
        const { title, letterNumber, letterDate, templateType, letterBody, staff } = req.body;

        const letter = new Letter({
            userId: req.user._id,
            title,
            letterNumber,
            letterDate,
            templateType,
            letterBody,
            staff
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
        const { title, letterNumber, letterDate, templateType, letterBody, staff } = req.body;

        const letter = await Letter.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id, isDeleted: false },
            { title, letterNumber, letterDate, templateType, letterBody, staff },
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

        // 1. Partial match for Title
        if (title) {
            query.title = { $regex: title, $options: 'i' };
        }

        // 2. Date Range for letterDate
        if (fromDate || toDate) {
            query.letterDate = {};
            if (fromDate) query.letterDate.$gte = new Date(fromDate);
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query.letterDate.$lte = end;
            }
        }

        // 3. Search by Staff Name (resolve to IDs)
        if (staffName) {
            const staffs = await Staff.find({
                ownerRef: req.user._id,
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');
            query.staff = { $in: staffs.map(s => s._id) };
        }

        // 4. Letter No (combined prefix + number + postfix)
        if (letterNo) {
            query.$or = [
                { 'letterNumber.number': { $regex: letterNo, $options: 'i' } },
                { 'letterNumber.prefix': { $regex: letterNo, $options: 'i' } },
                { 'letterNumber.postfix': { $regex: letterNo, $options: 'i' } }
            ];
            // Note: MongoDB doesn't easily support regex on concatenated fields without aggregation.
            // This checks if any part matches the search string.
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

module.exports = {
    createLetter,
    getLetters,
    getLetterById,
    updateLetter,
    deleteLetter,
    searchLetters
};
