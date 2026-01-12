const User = require('../../models/User-Model/User');
const OTP = require('../../models/Login-Model/OTP');
const jwt = require('jsonwebtoken');
const { recordLogin } = require('../../utils/securityHelper');
const SecurityValidation = require('../../utils/securityValidation');
const PerformanceOptimization = require('../../utils/performanceOptimization');
const { getCacheManager } = require('../../utils/cacheManager');
const { getPerformanceMonitor } = require('../../utils/performanceMonitor');

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
    const startTime = Date.now();
    const monitor = getPerformanceMonitor();
    const cacheManager = getCacheManager();

    try {
        const { phone, countryCode, type } = req.body;

        // Input validation with security checks
        const validationSchema = {
            phone: {
                type: 'phone',
                required: true,
                maxLength: 20
            },
            countryCode: {
                type: 'string',
                required: true,
                minLength: 2,
                maxLength: 5,
                pattern: /^\+/
            },
            type: {
                type: 'string',
                required: false,
                enum: ['signup', 'login', 'reset']
            }
        };

        const validation = SecurityValidation.validateInput(req.body, validationSchema);
        if (!validation.isValid) {
            monitor.trackRequest(req, res, Date.now() - startTime);
            return res.status(400).json({
                message: 'Validation failed',
                errors: validation.errors
            });
        }

        const { phone: sanitizedPhone, countryCode: sanitizedCountryCode, type: sanitizedType } = validation.data;

        // Rate limiting for OTP requests
        const rateLimitKey = `otp:${sanitizedPhone}`;
        const rateLimitResult = await SecurityValidation.checkRateLimit(rateLimitKey, 5, 300000); // 5 OTPs per 5 minutes

        if (!rateLimitResult.allowed) {
            monitor.trackRequest(req, res, Date.now() - startTime);
            return res.status(429).json({
                message: 'Too many OTP requests',
                retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            });
        }

        // Check cache for existing OTP
        const cacheKey = cacheManager.generateKey('otp', { phone: sanitizedPhone, countryCode: sanitizedCountryCode });
        let existingOTP = await cacheManager.get(cacheKey);

        if (existingOTP && existingOTP.expiresAt > Date.now()) {
            monitor.trackRequest(req, res, Date.now() - startTime);
            return res.status(200).json({
                message: 'OTP already sent',
                expiresIn: Math.ceil((existingOTP.expiresAt - Date.now()) / 1000)
            });
        }

        // DEV ONLY: Use static OTP for development/testing
        // In production, use: const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otp = '123456';
        console.log('DEV MODE: Using static OTP 123456 for testing');

        // Save OTP to database with optimized query
        const newOTP = new OTP({
            phone: sanitizedPhone,
            countryCode: sanitizedCountryCode,
            otp,
            type: sanitizedType || 'signup',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        });

        // Use parallel execution for database save and cache set
        const queries = [
            () => newOTP.save(),
            () => cacheManager.set(cacheKey, {
                otp,
                expiresAt: newOTP.expiresAt,
                type: sanitizedType
            }, 600000) // 10 minutes cache
        ];

        const results = await PerformanceOptimization.executeParallelQueries(queries);

        // Check if database save failed
        if (!results[0].success) {
            monitor.trackRequest(req, res, Date.now() - startTime);
            return res.status(500).json({ message: 'Failed to save OTP' });
        }

        // TODO: Send SMS via Twilio or other SMS service
        console.log(`OTP for ${sanitizedPhone}: ${otp}`);

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        });

        monitor.trackRequest(req, res, Date.now() - startTime);
        res.status(200).json({ message: 'OTP sent successfully' });

    } catch (error) {
        console.error('Send OTP error:', error);
        monitor.trackRequest(req, res, Date.now() - startTime);
        res.status(500).json({ message: 'Server error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
};

// @desc    Verify OTP for Signup/Login
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyOtpSignup = async (req, res) => {
    try {
        const { phone, countryCode, otp, type } = req.body;

        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ message: 'Phone number, country code, and OTP are required' });
        }

        // DEV ONLY: Accept static OTP for development/testing
        // In production, remove this check and only validate against database OTP
        if (otp === '123456') {
            console.log('DEV MODE: Static OTP 123456 accepted');
            // Delete any existing OTPs for this phone to maintain consistency
            await OTP.deleteMany({ phone, countryCode, type: type || 'signup' });
        } else {
            // Find OTP in database (normal flow)
            const otpRecord = await OTP.findOne({
                phone,
                countryCode,
                otp,
                type: type || 'signup',
            });

            if (!otpRecord) {
                return res.status(400).json({ message: 'Invalid OTP' });
            }

            // Check if OTP is expired
            if (new Date() > otpRecord.expiresAt) {
                return res.status(400).json({ message: 'OTP expired' });
            }

            // Delete OTP after verification
            await OTP.deleteOne({ _id: otpRecord._id });
        }

        res.status(200).json({ message: 'OTP verified successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { phone, countryCode } = req.body;

        if (!phone || !countryCode) {
            return res.status(400).json({ message: 'Phone number and country code are required' });
        }

        // Find user by phone
        const user = await User.findOne({ phone, countryCode });

        if (!user) {
            return res.status(400).json({ message: 'User not found. Please sign up first.' });
        }

        // For OTP-based login, no password validation needed
        // User should have verified OTP before calling this endpoint
        // Generate JWT
        const token = generateToken(user._id);

        // Record login - Fixed parameter order to match recordLogin(req, user)
        await recordLogin(req, user);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                phone: user.phone,
                countryCode: user.countryCode,
                companyName: user.companyName,
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Login user using User ID
// @route   POST /api/auth/login-userid
// @access  Public
const loginUserId = async (req, res) => {
    try {
        const { userId, password } = req.body;

        if (!userId || !password) {
            return res.status(400).json({ message: 'User ID and password are required' });
        }

        // Find user by userId
        const user = await User.findOne({ userId });

        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = password === user.password; // TODO: Implement proper password comparison

        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Generate JWT
        const token = generateToken(user._id);

        // Record login - Fixed parameter order to match recordLogin(req, user)
        await recordLogin(req, user);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                userId: user.userId,
                phone: user.phone,
                countryCode: user.countryCode,
                companyName: user.companyName,
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
const resendOtp = async (req, res) => {
    try {
        const { phone, countryCode, type } = req.body;

        if (!phone || !countryCode) {
            return res.status(400).json({ message: 'Phone number and country code are required' });
        }

        // Delete existing OTPs
        await OTP.deleteMany({ phone, countryCode });

        // DEV ONLY: Use static OTP for development/testing
        // In production, use: const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otp = '123456';
        console.log('DEV MODE: Using static OTP 123456 for testing');

        // Save new OTP
        const newOTP = new OTP({
            phone,
            countryCode,
            otp,
            type: type || 'signup',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        });

        await newOTP.save();

        // TODO: Send SMS via Twilio or other SMS service
        console.log(`New OTP for ${phone}: ${otp}`);

        res.status(200).json({ message: 'OTP resent successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    sendOtp,
    verifyOtpSignup,
    login,
    loginUserId,
    resendOtp
};
