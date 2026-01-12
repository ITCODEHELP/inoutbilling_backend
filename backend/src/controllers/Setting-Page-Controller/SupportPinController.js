const SupportPin = require('../../models/Setting-Model/SupportPin');
const crypto = require('crypto');

/**
 * @desc    Generate a secure 6-digit support PIN (expires in 8 minutes)
 * @route   POST /api/support-pin/generate
 * @access  Private
 */
const generatePin = async (req, res) => {
    try {
        const userId = req.user._id;

        // Generate 6-digit numeric PIN
        const pin = Math.floor(100000 + Math.random() * 900000).toString();

        // 8 minutes from now
        const expiresAt = new Date(Date.now() + 8 * 60 * 1000);

        // Upsert: Create new or update existing PIN for this user
        const supportPin = await SupportPin.findOneAndUpdate(
            { userId },
            { pin, expiresAt },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            data: {
                pin: supportPin.pin,
                expiresAt: supportPin.expiresAt
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

/**
 * @desc    Verify a support PIN for a specific user
 * @route   POST /api/support-pin/verify
 * @access  Private (or Public if userId is provided in body)
 */
const verifyPin = async (req, res) => {
    try {
        const { pin, userId } = req.body;

        // If logged in, prioritize req.user._id, otherwise use provided userId
        const targetUserId = userId || req.user?._id;

        if (!pin || !targetUserId) {
            return res.status(400).json({ success: false, message: 'PIN and User ID are required' });
        }

        const supportPin = await SupportPin.findOne({
            userId: targetUserId,
            pin: pin,
            expiresAt: { $gt: new Date() } // Ensure it's not expired
        });

        if (!supportPin) {
            return res.status(401).json({ success: false, message: 'Invalid or expired PIN' });
        }

        res.status(200).json({
            success: true,
            message: 'PIN verified successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

module.exports = {
    generatePin,
    verifyPin
};
