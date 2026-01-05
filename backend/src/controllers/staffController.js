const Staff = require('../models/Staff');
const bcrypt = require('bcrypt');

// @desc    Create a new staff account
// @route   POST /api/staff/create
// @access  Private (Owner only)
const createStaff = async (req, res) => {
    const {
        userId, fullName, phone, email, password, confirmPassword,
        isEnabled, activeHours, allowedSections
    } = req.body;

    // Validate required fields
    if (!userId || !fullName || !phone || !email || !password || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'All required fields must be provided',
            data: null
        });
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Passwords do not match',
            data: null
        });
    }

    try {
        // Check for duplicate userId, phone, or email
        const existingStaff = await Staff.findOne({
            $or: [
                { userId },
                { phone },
                { email }
            ]
        });

        if (existingStaff) {
            let conflictField = '';
            if (existingStaff.userId === userId) conflictField = 'User ID';
            else if (existingStaff.phone === phone) conflictField = 'Phone number';
            else if (existingStaff.email === email) conflictField = 'Email';

            return res.status(400).json({
                success: false,
                message: `${conflictField} already exists for another staff member`,
                data: null
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create staff
        const newStaff = await Staff.create({
            userId,
            fullName,
            phone,
            email,
            password: hashedPassword,
            isEnabled: isEnabled !== undefined ? isEnabled : true,
            activeHours: activeHours || '',
            allowedSections: allowedSections || [],
            ownerUserId: req.user.userId,
            ownerRef: req.user._id
        });

        // Remove password from response
        const staffData = newStaff.toObject();
        delete staffData.password;

        res.status(201).json({
            success: true,
            message: 'Staff account created successfully',
            data: staffData
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Fetch single staff by fullName (case-insensitive)
// @route   GET /api/staff/search/:name
// @access  Private (Owner only)
const getStaffByName = async (req, res) => {
    try {
        const staff = await Staff.findOne({
            fullName: { $regex: new RegExp(`^${req.params.name}$`, 'i') },
            ownerRef: req.user._id
        }).select('-password');

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found with that name',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            message: 'Staff details fetched successfully',
            data: staff
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            data: error.message
        });
    }
};

// @desc    Fetch all staff for the logged-in owner
// @route   GET /api/staff/all
// @access  Private (Owner only)
const getAllStaff = async (req, res) => {
    try {
        const staffList = await Staff.find({ ownerRef: req.user._id })
            .select('-password')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            message: 'Staff list fetched successfully',
            data: staffList
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
    createStaff,
    getStaffByName,
    getAllStaff
};
