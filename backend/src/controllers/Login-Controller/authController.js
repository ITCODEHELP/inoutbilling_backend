const User = require('../../models/User-Model/User');
const OTP = require('../../models/Login-Model/OTP');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Add for pw hashing
const { recordLogin } = require('../../utils/securityHelper');
const axios = require('axios');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate User ID (GSTBILL + timestamp + random)
const generateUserId = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(1000 + Math.random() * 9000);
    return `GSTBILL${timestamp}${random}`;
};

// Helper: Extract 10-digit from fullMobile (for UI responses)
const getDisplayMobile = (fullMobile) => fullMobile.replace(/^91/, '');

// Helper: Send OTP via MSG91 (unchanged, working)
const sendMsg91Otp = async (fullMobile, otp) => {
    const authKey = process.env.MSG91_AUTH_KEY;
    const templateId = process.env.MSG91_TEMPLATE_ID;

    if (!authKey || !templateId) {
        throw new Error('MSG91 config missing');
    }

    const payload = {
        template_id: templateId,
        recipients: [{ mobiles: fullMobile, otp }]
    };

    const axiosOptions = {
        method: 'POST',
        url: 'https://control.msg91.com/api/v5/flow',
        headers: { authkey: authKey, 'Content-Type': 'application/json' },
        data: payload
    };

    console.log('----------------------------------------------------');
    console.log('[MSG91 DEBUG] Target:', fullMobile);
    console.log('[MSG91 DEBUG] Payload:', JSON.stringify(payload, null, 2));
    console.log('----------------------------------------------------');

    try {
        const response = await axios(axiosOptions);
        if (response.data?.type !== 'success') {
            throw new Error(response.data?.message);
        }
        console.log('[MSG91] OTP sent success response:', response.data);
        return { success: true };
    } catch (err) {
        console.error('[MSG91] Request Failed:', err.message);
        if (err.response) {
            console.error('[MSG91] Response Data:', err.response.data);
        }
        return { success: false, error: err.response?.data?.message || err.message };
    }
};

// @desc    Send OTP (Internal Flow Detection)
// @route   POST /api/auth/send-otp
const sendOtp = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile required' });
        }

        const fullMobile = `91${mobile}`;
        console.log(`[Auth] SendOtp → ${fullMobile}`);

        // Rate limit: Max 6 OTPs/24h (use lean() for speed)
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const count = await OTP.countDocuments({
            mobile: fullMobile,
            createdAt: { $gte: since }
        });
        if (count >= 6) {
            return res.status(429).json({ message: 'Daily OTP limit reached' });
        }

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const result = await sendMsg91Otp(fullMobile, otp);
        if (!result.success) {
            return res.status(502).json({
                message: 'OTP send failed',
                providerError: result.error
            });
        }

        // Store OTP (use lean() on exists for perf)
        const userExists = await User.exists({ phone: fullMobile }).lean();
        const flowType = userExists ? 'login' : 'signup';
        await OTP.create({
            mobile: fullMobile,
            otp: Number(otp),
            type: flowType,
            expiryTime: new Date(Date.now() + 5 * 60 * 1000)
        });

        return res.status(200).json({ message: 'OTP sent successfully' });

    } catch (err) {
        console.error('[sendOtp] Error:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'OTP storage failed',
                error: Object.values(err.errors).map(e => `${e.path}: ${e.message}`).join('; ')
            });
        }
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @desc    Verify OTP (Auto-Detect: Login vs Signup)
// @route   POST /api/auth/verify-otp
const verifyOtp = async (req, res) => {
    try {
        const { mobile, countryCode = '91', otp } = req.body;

        // Validate inputs
        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile required' });
        }
        if (!otp || !/^\d{4}$/.test(otp)) {
            return res.status(400).json({ message: 'Valid 4-digit OTP required' });
        }

        const code = countryCode.replace(/\D/g, '');
        const number = mobile.replace(/\D/g, '');
        const fullMobile = `${code}${number}`;

        // Verify OTP (latest non-expired)
        const otpRecord = await OTP.findOne({
            mobile: fullMobile,
            otp: Number(otp), // Ensure numeric
            expiryTime: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (!otpRecord) {
            return res.status(400).json({ message: 'Invalid or expired OTP' });
        }

        // Check User
        let user = await User.findOne({ phone: fullMobile });

        if (user) {
            // LOGIN
            console.log(`[Auth] Login: User Found (${user._id})`);
            const token = generateToken(user._id);
            await recordLogin(req, user);
            await OTP.deleteOne({ _id: otpRecord._id }); // Cleanup
            return res.status(200).json({
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    userId: user.userId,
                    mobile: getDisplayMobile(fullMobile), // 10-digit for UI
                    redirect: 'dashboard'
                }
            });
        } else {
            // SIGNUP
            console.log(`[Auth] Signup: Creating New User`);
            const newUserId = generateUserId();
            user = await User.create({
                phone: fullMobile, // Full in DB
                countryCode: `+${code}`,
                userId: newUserId,
                isVerified: true
                // Add password: await bcrypt.hash(password, 10) if provided
            });
            const token = generateToken(user._id);
            await recordLogin(req, user);
            await OTP.deleteOne({ _id: otpRecord._id }); // Cleanup
            return res.status(201).json({
                message: 'Signup successful',
                token,
                user: {
                    id: user._id,
                    userId: user.userId,
                    mobile: getDisplayMobile(fullMobile), // 10-digit for UI
                    redirect: 'add-business'
                }
            });
        }

    } catch (error) {
        console.error('Verify OTP Error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                message: 'User creation failed',
                error: Object.values(error.errors).map(e => `${e.path}: ${e.message}`).join('; ')
            });
        }
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Login with User ID + Password
// @route   POST /api/auth/login-userid
const loginUserId = async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ message: 'User ID and password required' });
        }

        const user = await User.findOne({ userId });
        if (!user || !(await bcrypt.compare(password, user.password || ''))) { // Hash compare
            return res.status(400).json({ message: 'Invalid User ID or Password' });
        }

        const token = generateToken(user._id);
        await recordLogin(req, user);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                userId: user.userId,
                mobile: getDisplayMobile(user.phone), // 10-digit for UI
                redirect: 'dashboard'
            }
        });

    } catch (error) {
        console.error('[loginUserId] Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
    try {
        const { userId, email, gstin } = req.body;

        if (!userId || !email || !gstin) {
            return res.status(400).json({ message: 'User ID, email, and GSTIN required' });
        }

        const user = await User.findOne({ userId, email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid details.' });
        }

        // Check Linked Business for GSTIN
        const Business = require('../../models/Login-Model/Business');
        const business = await Business.findOne({ userId, gstin });

        if (!business) {
            return res.status(400).json({ message: 'Details do not match our records.' });
        }

        // TODO: Implement real email (e.g., via Nodemailer)
        // await sendResetEmail(user.email, generateResetToken(user._id));

        res.status(200).json({ message: 'Password reset link sent to your email.' });

    } catch (error) {
        console.error('[forgotPassword] Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
const resendOtp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || !/^\d{10}$/.test(mobile)) {
            return res.status(400).json({ message: 'Valid 10-digit mobile required' });
        }

        // Quick check: Don't resend if <2min since last
        const recentOtp = await OTP.findOne({
            mobile: `91${mobile}`,
            createdAt: { $gt: new Date(Date.now() - 2 * 60 * 1000) }
        }).sort({ createdAt: -1 });
        if (recentOtp) {
            return res.status(429).json({ message: 'Please wait 2 minutes before resending' });
        }

        // Reuse sendOtp (handles rest)
        return sendOtp(req, res);
    } catch (err) {
        console.error('[resendOtp] Error:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

module.exports = {
    sendOtp,
    verifyOtp,
    loginUserId,
    forgotPassword,
    resendOtp
};