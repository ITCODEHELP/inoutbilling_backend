const User = require('../../models/User-Model/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Configure Multer for business logos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/business_logos';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `logo-${req.user._id}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPG, JPEG, and PNG are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
}).single('logo');

// @desc    Upload business logo
// @route   POST /api/user/upload-logo
// @access  Private
const uploadLogo = (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        try {
            const user = await User.findById(req.user._id);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Remove old logo if exists
            if (user.businessLogo && fs.existsSync(user.businessLogo)) {
                try {
                    fs.unlinkSync(user.businessLogo);
                } catch (unlinkErr) {
                    console.error('Error deleting old logo:', unlinkErr);
                }
            }

            user.businessLogo = req.file.path;
            await user.save();

            res.status(200).json({
                success: true,
                message: 'Logo uploaded successfully',
                data: {
                    businessLogo: user.businessLogo
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server Error',
                error: error.message
            });
        }
    });
};

// @desc    Send verification email
// @route   POST /api/user/send-verification-email
// @access  Private
const sendVerificationEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ success: false, message: 'Email is already verified' });
        }

        // Generate single-use token
        const token = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = token;
        await user.save();

        // In a real app, send actual email here.
        // For now, we simulate and return the link as requested.
        const verificationLink = `${req.protocol}://${req.get('host')}/api/user/verify-email/${token}`;

        console.log(`Verification Email Sent to ${user.email || 'user'}: ${verificationLink}`);

        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully',
            data: {
                verificationLink // Returned for display/testing as per requirements
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

// @desc    Verify email
// @route   GET /api/user/verify-email/:token
// @access  Public
const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;
        const user = await User.findOne({ emailVerificationToken: token });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification link' });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined; // Single-use
        await user.save();

        // Redirect back to dashboard
        // Using a relative path which the frontend should handle or an absolute if frontend URL is known
        res.redirect('/dashboard?verified=true');
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
};

module.exports = {
    uploadLogo,
    sendVerificationEmail,
    verifyEmail
};
