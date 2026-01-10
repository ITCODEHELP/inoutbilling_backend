const User = require('../../models/User-Model/User');
const OTP = require('../../models/Login-Model/OTP');
const LoginHistory = require('../../models/Login-Model/LoginHistory');
const DispatchAddress = require('../../models/Setting-Model/DispatchAddress');
const bcrypt = require('bcrypt');

// @desc    Request OTP to change primary phone number
// @route   POST /api/setting-security/request-phone-change-otp
// @access  Private
const requestPhoneChangeOtp = async (req, res) => {
    const { newPhone } = req.body;

    if (!newPhone) {
        return res.status(400).json({
            success: false,
            message: 'New phone number is required',
            data: null
        });
    }

    try {
        // Check if new phone is already used by another user
        const existingUser = await User.findOne({ phone: newPhone });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already in use by another account',
                data: null
            });
        }

        // Static OTP for now as requested (123456)
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Store OTP in DB (indexed by newPhone)
        await OTP.findOneAndUpdate(
            { phone: newPhone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: 'OTP sent to new phone number',
            data: {
                phone: newPhone,
                otp: otpCode // Retained for development
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Verify OTP and change primary phone number
// @route   POST /api/setting-security/verify-phone-change-otp
// @access  Private
const verifyPhoneChangeOtp = async (req, res) => {
    const { newPhone, otp } = req.body;

    if (!newPhone || !otp) {
        return res.status(400).json({
            success: false,
            message: 'New phone and OTP are required',
            data: null
        });
    }

    try {
        const otpRecord = await OTP.findOne({ phone: newPhone });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found or expired',
                data: null
            });
        }

        if (otpRecord.expiresAt < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired',
                data: null
            });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP',
                data: null
            });
        }

        // OTP Verified
        // Double check uniqueness just in case it was registered in between
        const existingUser = await User.findOne({ phone: newPhone });
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Phone number already in use',
                data: null
            });
        }

        // Update user phone
        const user = await User.findById(req.user._id);
        user.phone = newPhone;
        await user.save();

        // Clean up OTP
        await OTP.deleteOne({ phone: newPhone });

        res.status(200).json({
            success: true,
            message: 'Phone number updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Request OTP to change email address
// @route   POST /api/setting-security/request-email-change-otp
// @access  Private
const requestEmailChangeOtp = async (req, res) => {
    const { newEmail } = req.body;

    if (!newEmail) {
        return res.status(400).json({
            success: false,
            message: 'New email address is required',
            data: null
        });
    }

    try {
        // Check if new email is already used by another user
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email address already in use by another account',
                data: null
            });
        }

        // Static OTP (123456)
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Store OTP in DB (indexed by newEmail)
        // Note: OTP model uses 'phone' field as identifier, we'll use email here as it's a string
        await OTP.findOneAndUpdate(
            { phone: newEmail },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: 'OTP sent to new email address',
            data: {
                email: newEmail,
                otp: otpCode // Retained for development
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Verify OTP and change email address
// @route   POST /api/setting-security/verify-email-change-otp
// @access  Private
const verifyEmailChangeOtp = async (req, res) => {
    const { newEmail, otp } = req.body;

    if (!newEmail || !otp) {
        return res.status(400).json({
            success: false,
            message: 'New email and OTP are required',
            data: null
        });
    }

    try {
        const otpRecord = await OTP.findOne({ phone: newEmail });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found or expired',
                data: null
            });
        }

        if (otpRecord.expiresAt < Date.now()) {
            return res.status(400).json({
                success: false,
                message: 'OTP expired',
                data: null
            });
        }

        if (otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP',
                data: null
            });
        }

        // OTP Verified
        // Double check uniqueness
        const existingUser = await User.findOne({ email: newEmail });
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Email address already in use',
                data: null
            });
        }

        // Update user email
        const user = await User.findById(req.user._id);
        user.email = newEmail;
        await user.save();

        // Clean up OTP
        await OTP.deleteOne({ phone: newEmail });

        res.status(200).json({
            success: true,
            message: 'Email address updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Request OTP to create/update User ID & Password
// @route   POST /api/setting-security/request-credentials-otp
// @access  Private
const requestCredentialsOtp = async (req, res) => {
    const { userId, password, confirmPassword } = req.body;

    if (!userId || !password || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'User ID, password, and confirm password are required',
            data: null
        });
    }

    // Validate User ID: 4–15 alphanumeric characters
    const userIdRegex = /^[a-zA-Z0-9]{4,15}$/;
    if (!userIdRegex.test(userId)) {
        return res.status(400).json({
            success: false,
            message: 'User ID must be 4–15 alphanumeric characters',
            data: null
        });
    }

    // Ensure passwords match
    if (password !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Passwords do not match',
            data: null
        });
    }

    try {
        // Ensure User ID is unique (excluding the current user if they already have this ID)
        const existingUser = await User.findOne({ userId });
        if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'User ID is already taken',
                data: null
            });
        }

        // Trigger existing OTP flow - send to user's registered phone
        const phone = req.user.phone;
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await OTP.findOneAndUpdate(
            { phone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: 'OTP sent to your registered phone number',
            data: {
                phone: phone,
                otp: otpCode // For dev
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Verify OTP and update User ID & Password
// @route   POST /api/setting-security/verify-credentials-otp
// @access  Private
const verifyCredentialsOtp = async (req, res) => {
    const { otp, userId, password } = req.body;

    if (!otp || !userId || !password) {
        return res.status(400).json({
            success: false,
            message: 'OTP, User ID, and password are required',
            data: null
        });
    }

    try {
        const phone = req.user.phone;
        const otpRecord = await OTP.findOne({ phone });

        if (!otpRecord || otpRecord.expiresAt < Date.now() || otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
                data: null
            });
        }

        // OTP Verified
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user record
        const user = await User.findById(req.user._id);
        user.userId = userId;
        user.password = hashedPassword;
        await user.save();

        // Clean up OTP
        await OTP.deleteOne({ phone });

        // Remove password from response
        const userResponse = user.toObject();
        delete userResponse.password;

        res.status(200).json({
            success: true,
            message: 'Credentials updated successfully',
            data: userResponse
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Update security settings (e.g., toggle location tracking)
// @route   POST /api/setting-security/update-settings
// @access  Private
const updateSecuritySettings = async (req, res) => {
    const { trackLoginLocation } = req.body;

    if (typeof trackLoginLocation !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'trackLoginLocation must be a boolean',
            data: null
        });
    }

    try {
        const user = await User.findById(req.user._id);
        user.trackLoginLocation = trackLoginLocation;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'Security settings updated successfully',
            data: { trackLoginLocation: user.trackLoginLocation }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Get login history and active sessions
// @route   GET /api/setting-security/history
// @access  Private
const getLoginHistory = async (req, res) => {
    try {
        const history = await LoginHistory.find({ userId: req.user._id }).sort({ loginTime: -1 });

        // Map data to handle "Location tracked off" logic if user disabled it globally now?
        // Actually the prompt says: "when the flag is disabled, continue tracking ... but exclude location data from responses"
        // This implies we check the CURRENT user flag.
        const user = await User.findById(req.user._id);
        const hideLocation = !user.trackLoginLocation;

        const processedHistory = history.map(item => {
            const doc = item.toObject();
            if (hideLocation) {
                delete doc.location;
            }
            return doc;
        });

        const activeDevices = processedHistory.filter(item => item.isActive);
        const loginLog = processedHistory;

        res.status(200).json({
            success: true,
            message: 'Login history fetched successfully',
            data: {
                activeDevices,
                loginLog
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Logout from all devices (mark all sessions inactive)
// @route   POST /api/setting-security/logout-all
// @access  Private
const logoutAllDevices = async (req, res) => {
    try {
        await LoginHistory.updateMany(
            { userId: req.user._id, isActive: true },
            { isActive: false }
        );

        res.status(200).json({
            success: true,
            message: 'Logged out from all devices successfully',
            data: null
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Update E-Way Bill & E-Invoice Credentials (non-GSP)
// @route   POST /api/setting-security/update-eway-credentials
// @access  Private
const updateEwayCredentials = async (req, res) => {
    const { userId, password, ewayBillUserId, ewayBillPassword } = req.body;

    if (!userId || !password || !ewayBillUserId || !ewayBillPassword) {
        return res.status(400).json({
            success: false,
            message: 'User ID, Password, E-Way User ID, and E-Way Password are required',
            data: null
        });
    }

    try {
        const user = await User.findById(req.user._id);

        // Check if primary User ID and Password exist
        if (!user.userId || !user.password) {
            return res.status(400).json({
                success: false,
                message: 'Please first create User ID & Password from the Login & Security section',
                data: null
            });
        }

        // Validate provided User ID matches stored primary User ID
        if (userId !== user.userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID not found',
                data: null
            });
        }

        // Validate provided Password matches stored primary Password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Incorrect password',
                data: null
            });
        }

        // Securely hash E-Way Bill Password and persist
        const salt = await bcrypt.genSalt(10);
        const hashedEwayPassword = await bcrypt.hash(ewayBillPassword, salt);

        user.ewayBillUserId = ewayBillUserId;
        user.ewayBillPassword = hashedEwayPassword;
        await user.save();

        res.status(200).json({
            success: true,
            message: 'E-Way Bill & E-Invoice credentials updated successfully',
            data: {
                userId: user.userId,
                ewayBillUserId: user.ewayBillUserId,
                gstNumber: user.gstNumber
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Toggle E-Invoice Enable/Disable state
// @route   POST /api/setting-security/toggle-einvoice
// @access  Private
const toggleEInvoice = async (req, res) => {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
        return res.status(400).json({
            success: false,
            message: 'Enabled state must be a boolean',
            data: null
        });
    }

    try {
        const user = await User.findById(req.user._id);
        user.eInvoiceEnabled = enabled;
        await user.save();

        res.status(200).json({
            success: true,
            message: `E-Invoice ${enabled ? 'enabled' : 'disabled'} successfully`,
            data: { eInvoiceEnabled: user.eInvoiceEnabled }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Get current E-Invoice Enable/Disable state
// @route   GET /api/setting-security/einvoice-setting
// @access  Private
const getEInvoiceSetting = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.status(200).json({
            success: true,
            message: 'E-Invoice setting fetched successfully',
            data: { eInvoiceEnabled: user.eInvoiceEnabled || false }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Get current business profile
// @route   GET /api/setting-security/business-profile
// @access  Private
const getBusinessProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('gstNumber companyName address pincode city state displayPhone fullName pan companyType landmark additionalLicense lutNo iecNo website gstAutoFill updateGstOnPreviousInvoices');

        res.status(200).json({
            success: true,
            message: 'Business profile fetched successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Request OTP to update business profile
// @route   POST /api/setting-security/request-business-profile-otp
// @access  Private
const requestBusinessProfileOtp = async (req, res) => {
    try {
        const phone = req.user.phone;
        const otpCode = '123456';
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await OTP.findOneAndUpdate(
            { phone },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        res.status(200).json({
            success: true,
            message: 'OTP sent to your registered phone number',
            data: {
                phone,
                otp: otpCode // For dev
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Verify OTP and update business profile
// @route   POST /api/setting-security/verify-business-profile-otp
// @access  Private
const verifyAndUpdateBusinessProfile = async (req, res) => {
    const {
        otp, gstNumber, pan, companyType, address, landmark,
        pincode, city, state, additionalLicense, lutNo,
        iecNo, website, gstAutoFill, updateGstOnPreviousInvoices
    } = req.body;

    if (!otp) {
        return res.status(400).json({
            success: false,
            message: 'OTP is required',
            data: null
        });
    }

    try {
        const phone = req.user.phone;
        const otpRecord = await OTP.findOne({ phone });

        if (!otpRecord || otpRecord.expiresAt < Date.now() || otpRecord.otp !== otp) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired OTP',
                data: null
            });
        }

        // OTP Verified
        const user = await User.findById(req.user._id);

        // Update only allowed fields (Company Name, Full Name, Display Phone are locked)
        if (gstNumber !== undefined) user.gstNumber = gstNumber;
        if (pan !== undefined) user.pan = pan;
        if (companyType !== undefined) user.companyType = companyType;
        if (address !== undefined) user.address = address;
        if (landmark !== undefined) user.landmark = landmark;
        if (pincode !== undefined) user.pincode = pincode;
        if (city !== undefined) user.city = city;
        if (state !== undefined) user.state = state;
        if (additionalLicense !== undefined) user.additionalLicense = additionalLicense;
        if (lutNo !== undefined) user.lutNo = lutNo;
        if (iecNo !== undefined) user.iecNo = iecNo;
        if (website !== undefined) user.website = website;
        if (gstAutoFill !== undefined) user.gstAutoFill = gstAutoFill;
        if (updateGstOnPreviousInvoices !== undefined) user.updateGstOnPreviousInvoices = updateGstOnPreviousInvoices;

        await user.save();

        // Clean up OTP
        await OTP.deleteOne({ phone });

        res.status(200).json({
            success: true,
            message: 'Business profile updated successfully',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Add a new dispatch address
// @route   POST /api/setting-security/dispatch-address
// @access  Private
const addDispatchAddress = async (req, res) => {
    const {
        gstNumber, gstAutoFill, companyName, name, phone,
        email, addressLine1, landmark, city, state, pincode, country
    } = req.body;

    // Validate required fields
    if (!companyName || !name || !phone || !email || !addressLine1 || !city || !state || !pincode) {
        return res.status(400).json({
            success: false,
            message: 'All basic address fields are required (Company Name, Name, Phone, Email, Address Line 1, City, State, Pincode)',
            data: null
        });
    }

    try {
        const savedAddress = await DispatchAddress.create({
            userId: req.user.userId,
            userRef: req.user._id,
            gstNumber,
            gstAutoFill,
            companyName,
            name,
            phone,
            email,
            addressLine1,
            landmark,
            city,
            state,
            pincode,
            country: country || 'India'
        });

        res.status(201).json({
            success: true,
            message: 'Dispatch address added successfully',
            data: savedAddress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Get all dispatch addresses for the logged-in user
// @route   GET /api/setting-security/dispatch-addresses
// @access  Private
const getDispatchAddresses = async (req, res) => {
    try {
        const addresses = await DispatchAddress.find({ userRef: req.user._id }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Dispatch addresses fetched successfully',
            data: addresses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Fetch GSTIN and organisation details for dispatch form auto-fill
// @route   GET /api/setting-security/gst-autofill-dispatch
// @access  Private
const getGstAutofillDispatch = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('gstNumber companyName address city state pincode');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                data: null
            });
        }

        // Fetch GSTIN from Business Profile
        let gstNumber = user.gstNumber ? user.gstNumber.trim() : '';

        // If stored GSTIN is missing or a placeholder
        if (!gstNumber || gstNumber === '...' || gstNumber.toLowerCase() === 'null') {
            return res.status(400).json({
                success: false,
                message: 'GSTIN not configured in Business Profile',
                data: null
            });
        }

        gstNumber = gstNumber.toUpperCase();

        // Indian GSTIN validation (15 characters: 2 digits + 10 PAN + 1 entity + Z + checksum)
        const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/;

        if (!gstRegex.test(gstNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid GSTIN: Format is incorrect',
                data: { gstNumber }
            });
        }

        // Return data regardless of what client sent (ignoring client '...' or empty input as requested)
        res.status(200).json({
            success: true,
            message: 'GSTIN data fetched successfully',
            data: {
                gstNumber,
                companyName: user.companyName,
                address: user.address,
                city: user.city,
                state: user.state,
                pincode: user.pincode
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

module.exports = {
    requestPhoneChangeOtp,
    verifyPhoneChangeOtp,
    requestEmailChangeOtp,
    verifyEmailChangeOtp,
    requestCredentialsOtp,
    verifyCredentialsOtp,
    updateSecuritySettings,
    getLoginHistory,
    logoutAllDevices,
    updateEwayCredentials,
    toggleEInvoice,
    getEInvoiceSetting,
    getBusinessProfile,
    requestBusinessProfileOtp,
    verifyAndUpdateBusinessProfile,
    addDispatchAddress,
    getDispatchAddresses,
    getGstAutofillDispatch
};
