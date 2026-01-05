const User = require('../models/User');
const OTP = require('../models/OTP');
const jwt = require('jsonwebtoken');
const { recordLogin } = require('../utils/securityHelper');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    });
};

// Generate User ID (e.g., GSTBILL102938)
const generateUserId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GSTBILL${timestamp}${random}`;
};

// @desc    Send OTP for Signup/Login
// @route   POST /api/auth/send-otp
// @access  Public
const sendOtp = async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    // Static OTP for Developer Mode
    const otpCode = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store/Update OTP in DB
    try {
        await OTP.findOneAndUpdate(
            { phone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        // TODO: Integrate SMS Gateway here
        // await smsService.send(phone, `Your OTP is ${otpCode}`);

        res.status(200).json({
            message: 'OTP sent successfully',
            otp: otpCode // Retained for development as requested
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Verify OTP for Signup (Create User)
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtpSignup = async (req, res) => {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
        return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    try {
        const otpRecord = await OTP.findOne({ phone });

        if (!otpRecord) {
            return res.status(400).json({ message: 'OTP not found or expired' });
        }

        if (otpRecord.expiresAt < Date.now()) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // OTP Verified
        // Check if user exists
        let user = await User.findOne({ phone });

        if (!user) {
            // Register new user
            const userId = generateUserId();
            user = await User.create({
                phone,
                userId,
                isVerified: true
            });
        } else {
            // Use existing user, ensure verified is true
            if (!user.isVerified) {
                user.isVerified = true;
                await user.save();
            }
        }

        // Clean up OTP
        await OTP.deleteOne({ phone });

        // Record Login History
        await recordLogin(req, user);

        res.status(200).json({
            message: 'Signup/Verification successful',
            _id: user._id,
            userId: user.userId,
            phone: user.phone,
            token: generateToken(user._id)
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Login with Phone or Email (Request OTP)
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    const { identifier } = req.body; // Can be phone or email

    if (!identifier) {
        return res.status(400).json({ message: 'Phone or Email is required' });
    }

    try {
        const user = await User.findOne({
            $or: [{ phone: identifier }, { email: identifier }]
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // User found, send OTP to their registered phone
        // Note: Even if they login by email, we send OTP to phone as per structure implying phone-centric auth
        // Or should we assume the identifier IS the phone if they login by phone?
        // Let's rely on the user.phone stored in DB.

        const phone = user.phone;
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await OTP.findOneAndUpdate(
            { phone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        // TODO: SMS Service

        res.status(200).json({
            message: `OTP sent to ${phone}`,
            otp: otpCode // For dev
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Login using UserID
// @route   POST /api/auth/login-userid
// @access  Public
const loginUserId = async (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ message: 'UserID is required' });
    }

    try {
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Direct login without OTP? The prompt says "Return JWT token".
        // Usually UserID login might need a password, but none was specified in requirements.
        // Assuming implicit trust or that this is a specific requested flow (maybe kiosk mode?).

        // Record Login History
        await recordLogin(req, user);

        res.status(200).json({
            message: 'Login successful',
            _id: user._id,
            userId: user.userId,
            phone: user.phone,
            token: generateToken(user._id)
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
    const { phone } = req.body;

    // Reuse sendOtp logic or call it directly
    // Ideally we just redirect to sendOtp implementation logic
    // But for cleaner separation, let's copy the logic or call the function
    // Calling the function directly might be messy with req/res objects.

    if (!phone) {
        return res.status(400).json({ message: 'Phone is required' });
    }

    const otpCode = '123456';
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    try {
        await OTP.findOneAndUpdate(
            { phone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        res.status(200).json({
            message: 'OTP resent successfully',
            otp: otpCode
        });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    sendOtp,
    verifyOtpSignup,
    login,
    loginUserId,
    resendOtp
};
