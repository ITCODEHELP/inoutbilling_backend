const AdditionalCharge = require('../../models/Additional-Charge-Model/AdditionalCharge');

// @desc    Create or return existing Additional Charge
// @route   POST /api/additional-charges
// @access  Private
const createAdditionalCharge = async (req, res) => {
    try {
        const {
            name,
            productNote,
            price,
            hsnSacCode,
            noITC,
            tax,
            isServiceItem
        } = req.body;

        // Check for duplicates based on name + HSN/SAC code per user
        let additionalCharge = await AdditionalCharge.findOne({
            userId: req.user._id,
            name: { $regex: new RegExp(`^${name}$`, 'i') }, // Case-insensitive exact match
            hsnSacCode
        });

        if (additionalCharge) {
            return res.status(200).json({
                success: true,
                message: 'Additional charge already exists',
                data: additionalCharge
            });
        }

        additionalCharge = await AdditionalCharge.create({
            userId: req.user._id,
            name,
            productNote,
            price,
            hsnSacCode,
            noITC,
            tax,
            isServiceItem
        });

        res.status(201).json({
            success: true,
            message: 'Additional charge created successfully',
            data: additionalCharge
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ success: false, message: messages.join(', ') });
        }
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get all Additional Charges
// @route   GET /api/additional-charges
// @access  Private
const getAllAdditionalCharges = async (req, res) => {
    try {
        const additionalCharges = await AdditionalCharge.find({ userId: req.user._id })
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: additionalCharges.length,
            data: additionalCharges
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    createAdditionalCharge,
    getAllAdditionalCharges
};
