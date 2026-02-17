const Staff = require('../../models/Setting-Model/Staff');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// --- Helpers --------------------------------------------------------------

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;

// Allowed special characters for password strength calculation
const SPECIAL_CHARS = `!@#$%^&*()_+-={}[]|:;"'<>,.?/`;

// Phone: exactly 10 numeric digits
const PHONE_REGEX = /^\d{10}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Generate JWT for Staff
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

/**
 * Configuration for all available staff sections and their allowed permissions.
 *
 * Each key is the section name as it should appear in the DB/Frontend.
 * The value defines the MAXIMUM allowed permissions for that section.
 *
 * If a permission is `false` in this config, it cannot be enabled for the staff.
 */
const SECTION_PERMISSION_CONFIG = {
    // --- Dashboard ---
    'Dashboard': { view: true, add: false, edit: false, remove: false },

    // --- Main Modules (View, Add, Edit, Remove) ---
    'Customer / Vendor': { view: true, add: true, edit: true, remove: true },
    'Product': { view: true, add: true, edit: true, remove: true },
    'Transport': { view: true, add: true, edit: true, remove: true },
    'Additional Charges': { view: true, add: true, edit: true, remove: true },
    'Sale Invoice': { view: true, add: true, edit: true, remove: true },
    'Purchase Invoice': { view: true, add: true, edit: true, remove: true },
    'Inward Payment Receipt': { view: true, add: true, edit: true, remove: true },
    'Outward Payment Receipt': { view: true, add: true, edit: true, remove: true },

    // --- Expense & Income ---
    'Daily Expenses': { view: true, add: true, edit: true, remove: true },
    'Other Income': { view: true, add: true, edit: true, remove: true },

    // --- Other Documents ---
    'Delivery Challan': { view: true, add: true, edit: true, remove: true },
    'Quotations': { view: true, add: true, edit: true, remove: true },
    'Proformas': { view: true, add: true, edit: true, remove: true },
    'Purchase Order': { view: true, add: true, edit: true, remove: true },
    'Sale Order': { view: true, add: true, edit: true, remove: true },
    'Job Work': { view: true, add: true, edit: true, remove: true },
    'Credit Note': { view: true, add: true, edit: true, remove: true },
    'Debit Note': { view: true, add: true, edit: true, remove: true },
    'Multi Currency Invoice': { view: true, add: true, edit: true, remove: true },
    'Bank Ledger': { view: true, add: true, edit: true, remove: true },
    'Letters': { view: true, add: true, edit: true, remove: true },
    'Packing List': { view: true, add: true, edit: true, remove: true },
    'Manufacture': { view: true, add: true, edit: true, remove: true },

    // --- Reports (View Only) ---
    'Sale Report': { view: true, add: false, edit: false, remove: false },
    'Purchase Report': { view: true, add: false, edit: false, remove: false },
    'Profit&Lost Report': { view: true, add: false, edit: false, remove: false },
    'Stock Report': { view: true, add: false, edit: false, remove: false },
    'Product Report': { view: true, add: false, edit: false, remove: false },
    'Daily Expenses Report': { view: true, add: false, edit: false, remove: false },
    'Other Income Report': { view: true, add: false, edit: false, remove: false },
    'Other Document': { view: true, add: false, edit: false, remove: false },
    'Company Ledger': { view: true, add: false, edit: false, remove: false },
    'Company Outstanding': { view: true, add: false, edit: false, remove: false },
    'GSTR': { view: true, add: false, edit: false, remove: false },

    // --- Settings (Edit Only, Export View Only - assuming 'Export' is a section based on input, or ignores if not) ---
    'Membership Detail': { view: false, add: false, edit: true, remove: false },
    'Organization Detail': { view: false, add: false, edit: true, remove: false },
    'Invoice Options': { view: false, add: false, edit: true, remove: false },
    'Translation Options': { view: false, add: false, edit: true, remove: false },
    'Email Options': { view: false, add: false, edit: true, remove: false },
    'Payment Reminder': { view: false, add: false, edit: true, remove: false },
    'Design Custom Header': { view: false, add: false, edit: true, remove: false },
    'Go Drive': { view: false, add: false, edit: true, remove: false },

    // --- Other Options ---
    'E-Way & E-Invoice': { view: true, add: true, edit: false, remove: true },
    'Sale Invoice Allowed Price Change': { view: true, add: false, edit: false, remove: false },
    'Notifications': { view: true, add: false, edit: false, remove: false },
    'Allowed User To Change Document No': { view: false, add: false, edit: true, remove: false },
    'Show Document Created by This User Only': { view: true, add: false, edit: false, remove: false },
    'Generate Barcode': { view: true, add: false, edit: false, remove: false }
};

/**
 * List of all available staff sections derived from the config.
 */
const ALL_STAFF_SECTIONS = Object.keys(SECTION_PERMISSION_CONFIG);

/**
 * Determine password strength based on composition.
 * Returns one of: 'weak' | 'medium' | 'strong'
 */
const getPasswordStrength = (password = '') => {
    const hasLetter = /[A-Za-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecial = new RegExp(`[${SPECIAL_CHARS.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}]`).test(password);

    // Weak: only alphabets or only numbers or only special characters
    if (
        (hasLetter && !hasNumber && !hasSpecial) ||
        (!hasLetter && hasNumber && !hasSpecial) ||
        (!hasLetter && !hasNumber && hasSpecial)
    ) {
        return 'weak';
    }

    // Medium: alphabets + numbers (no special)
    if (hasLetter && hasNumber && !hasSpecial) {
        return 'medium';
    }

    // Strong: alphabets + numbers + special characters
    if (hasLetter && hasNumber && hasSpecial) {
        return 'strong';
    }

    // Fallback: treat as weak if it does not fit any clear bucket
    return 'weak';
};

/**
 * Normalize allowedSections input to unified structure.
 * Accepts:
 * - Array of strings: ['Sale Invoice', 'Customer']
 * - Array of objects: [{ sectionName, permissions }]
 */
const normalizeAllowedSections = (allowedSections) => {
    if (!Array.isArray(allowedSections)) return [];

    return allowedSections.map((entry) => {
        let sectionName, requestedPerms;

        // Handle backward compatibility or simple string input
        if (typeof entry === 'string') {
            sectionName = entry;
            // Default to full requested checks, we will filter by config later
            requestedPerms = { view: true, add: true, edit: true, remove: true };
        } else {
            sectionName = entry.sectionName || '';
            requestedPerms = entry.permissions || {};
        }

        const config = SECTION_PERMISSION_CONFIG[sectionName];

        // If section is unknown, return all false to be safe
        if (!config) {
            return {
                sectionName,
                permissions: { view: false, add: false, edit: false, remove: false }
            };
        }

        // 1. Determine base permissions based on config (intersection of requested and allowed)
        let finalView = !!requestedPerms.view && config.view;
        let finalAdd = !!requestedPerms.add && config.add;
        let finalEdit = !!requestedPerms.edit && config.edit;
        let finalRemove = !!requestedPerms.remove && config.remove;

        // 2. Apply "View Dependency" Rule:
        // "if user deselect the view of any filed ... than all field ... are deselect"
        // This means if a section supports view (config.view is true) but the user turned it off (finalView is false),
        // then they cannot have other permissions either.
        if (config.view === true && finalView === false) {
            finalAdd = false;
            finalEdit = false;
            finalRemove = false;
        }

        return {
            sectionName,
            permissions: {
                view: finalView,
                add: finalAdd,
                edit: finalEdit,
                remove: finalRemove
            }
        };
    });
};

/**
 * Build a full-permission matrix for ALL_STAFF_SECTIONS.
 * Used when selectAllPermissions === true and the client
 * does not send an explicit allowedSections array.
 * Returns the MAXIMUM allowed permissions for every section.
 */
const buildAllSectionsFullPermissions = () =>
    Object.keys(SECTION_PERMISSION_CONFIG).map((sectionName) => {
        const config = SECTION_PERMISSION_CONFIG[sectionName];
        return {
            sectionName,
            permissions: {
                view: config.view,
                add: config.add,
                edit: config.edit,
                remove: config.remove
            }
        };
    });

/**
 * Merge provided allowedSections with default permissions for all other sections.
 * - Sections present in `allowedSections` are normalized and kept.
 * - Sections NOT present are added with all permissions set to FALSE.
 * Returns a full list of all sections defined in SECTION_PERMISSION_CONFIG.
 */
const mergeAllowedSectionsWithDefaults = (allowedSections) => {
    const providedMap = new Map();

    // 1. Normalize and map provided sections
    if (Array.isArray(allowedSections)) {
        normalizeAllowedSections(allowedSections).forEach((item) => {
            providedMap.set(item.sectionName, item);
        });
    }

    // 2. Build full list
    return Object.keys(SECTION_PERMISSION_CONFIG).map((sectionName) => {
        // If provided, use it
        if (providedMap.has(sectionName)) {
            return providedMap.get(sectionName);
        }

        // If not provided, return default disabled state
        return {
            sectionName,
            permissions: {
                view: false,
                add: false,
                edit: false,
                remove: false
            }
        };
    });
};

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate and normalize account active hours payload.
 * Returns { valid, message, normalized }.
 */
const validateAccountActiveHours = (enabled, accountActiveHours) => {
    if (!enabled) {
        return { valid: true, normalized: [] };
    }

    if (!Array.isArray(accountActiveHours) || accountActiveHours.length < 7) {
        return {
            valid: false,
            message: 'accountActiveHours must contain all 7 days when accountActiveHoursEnabled is true'
        };
    }

    const byDay = {};
    for (const entry of accountActiveHours) {
        if (!entry || typeof entry !== 'object') {
            return { valid: false, message: 'Each accountActiveHours entry must be an object' };
        }
        const day = entry.day;
        const startTime = entry.startTime;
        const endTime = entry.endTime;

        if (!DAYS_OF_WEEK.includes(day)) {
            return { valid: false, message: `Invalid day in accountActiveHours: ${day}` };
        }
        if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
            return {
                valid: false,
                message: `Invalid time format for ${day}. Expected HH:mm (24hr)`
            };
        }

        const toMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        // if (toMinutes(startTime) >= toMinutes(endTime)) {
        //     return {
        //         valid: false,
        //         message: `Start time must be less than end time for ${day}`
        //     };
        // }

        byDay[day] = { day, startTime, endTime };
    }

    // Ensure all 7 days exist
    for (const day of DAYS_OF_WEEK) {
        if (!byDay[day]) {
            return {
                valid: false,
                message: `Missing active hours configuration for ${day}`
            };
        }
    }

    const normalized = DAYS_OF_WEEK.map((day) => byDay[day]);
    return { valid: true, normalized };
};

// @desc    Create a new staff account
// @route   POST /api/staff/create
// @access  Private (Owner only)
const createStaff = async (req, res) => {
    const {
        userId,
        fullName,
        phone,
        email,
        password,
        confirmPassword,
        isEnabled,
        isActive,
        enable, // Add support for 'enable' field
        activeHours, // legacy, kept for backward compatibility
        accountActiveHoursEnabled,
        accountActiveHours,
        allowedSections,
        selectAllPermissions
    } = req.body;

    // Validate required fields
    if (!userId || !fullName || !phone || !email || !password || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'All required fields must be provided',
            data: null
        });
    }

    // Phone validation: exactly 10 numeric digits
    if (!PHONE_REGEX.test(phone)) {
        return res.status(400).json({
            success: false,
            message: 'Number must be having length 10',
            data: null
        });
    }

    // Email validation
    if (!EMAIL_REGEX.test(email)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid email address',
            data: null
        });
    }

    // Password length validation
    if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
            passwordStrength: getPasswordStrength(password),
            passwordMatch: false,
            data: null
        });
    }

    // Confirm password validation
    if (password !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Password Not Matched',
            passwordMatch: false,
            data: null
        });
    }

    const passwordStrength = getPasswordStrength(password);

    try {
        // Check for duplicate userId, phone, or email
        const existingStaff = await Staff.findOne({
            $or: [{ userId }, { phone }, { email }]
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

        // Normalize allowed sections (permission matrix)
        let normalizedSections;
        if (selectAllPermissions) {
            // Full permissions for all sections
            normalizedSections = buildAllSectionsFullPermissions();
        } else {
            // Merge provided sections with defaults (prevent missing keys)
            normalizedSections = mergeAllowedSectionsWithDefaults(allowedSections);
        }

        // Validate account active hours if enabled
        const hoursEnabled = !!accountActiveHoursEnabled;
        const { valid, message, normalized } = validateAccountActiveHours(
            hoursEnabled,
            accountActiveHours
        );

        if (!valid) {
            return res.status(400).json({
                success: false,
                message,
                data: null
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const effectiveActive =
            typeof isActive === 'boolean'
                ? isActive
                : typeof isEnabled === 'boolean'
                    ? isEnabled
                    : typeof enable === 'boolean'
                        ? enable
                        : true;

        // Create staff
        const newStaff = await Staff.create({
            userId,
            fullName,
            phone,
            email,
            password: hashedPassword,
            isEnabled: effectiveActive,
            isActive: effectiveActive,
            // legacy field, kept for compatibility
            activeHours: activeHours || '',
            // new structured fields
            accountActiveHoursEnabled: hoursEnabled,
            accountActiveHours: normalized,
            allowedSections: normalizedSections,
            passwordStrength,
            ownerUserId: req.user.userId,
            ownerRef: req.user._id,
            createdByOwnerId: req.user._id
        });

        // Remove password from response
        const staffData = newStaff.toObject();
        delete staffData.password;

        res.status(201).json({
            success: true,
            message: 'Staff account created successfully',
            passwordStrength,
            passwordMatch: true,
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

// @desc    Update an existing staff account
// @route   PUT /api/staff/:id
// @access  Private (Owner only)
const updateStaff = async (req, res) => {
    const staffId = req.params.id;
    const {
        userId,
        fullName,
        phone,
        email,
        password,
        confirmPassword,
        isEnabled,
        isActive,
        enable, // Add support for 'enable' field
        activeHours,
        accountActiveHoursEnabled,
        accountActiveHours,
        allowedSections,
        selectAllPermissions
    } = req.body;

    try {
        const staff = await Staff.findOne({ _id: staffId, ownerRef: req.user._id });
        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff member not found',
                data: null
            });
        }

        // Handle uniqueness for userId, phone, email if changed
        if (userId && userId !== staff.userId) {
            const exists = await Staff.findOne({ userId });
            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'User ID already exists for another staff member',
                    data: null
                });
            }
            staff.userId = userId;
        }

        if (phone && phone !== staff.phone) {
            // Phone validation on update
            if (!PHONE_REGEX.test(phone)) {
                return res.status(400).json({
                    success: false,
                    message: 'Number must be having length 10',
                    data: null
                });
            }

            const exists = await Staff.findOne({ phone });
            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Phone number already exists for another staff member',
                    data: null
                });
            }
            staff.phone = phone;
        }

        if (email && email !== staff.email) {
            // Email validation on update
            if (!EMAIL_REGEX.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid email address',
                    data: null
                });
            }

            const exists = await Staff.findOne({ email });
            if (exists) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists for another staff member',
                    data: null
                });
            }
            staff.email = email;
        }

        if (fullName) {
            staff.fullName = fullName;
        }

        let passwordStrength = staff.passwordStrength || 'weak';
        let passwordMatch = true;

        // Optional password update
        if (password || confirmPassword) {
            if (!password || !confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Both password and confirmPassword are required to update password',
                    data: null
                });
            }

            if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
                    passwordStrength: getPasswordStrength(password),
                    passwordMatch: false,
                    data: null
                });
            }

            if (password !== confirmPassword) {
                return res.status(400).json({
                    success: false,
                    message: 'Password Not Matched',
                    passwordMatch: false,
                    data: null
                });
            }

            passwordStrength = getPasswordStrength(password);
            passwordMatch = true;

            const salt = await bcrypt.genSalt(10);
            staff.password = await bcrypt.hash(password, salt);
            staff.passwordStrength = passwordStrength;
        }

        // Normalize allowed sections / select all logic
        if (typeof selectAllPermissions === 'boolean') {
            if (selectAllPermissions) {
                staff.allowedSections = buildAllSectionsFullPermissions();
            } else {
                // If explicit false, rely on provided sections but MERGE with defaults
                // If allowedSections is undefined, mergeAllowedSectionsWithDefaults maps it to empty -> all false
                staff.allowedSections = mergeAllowedSectionsWithDefaults(allowedSections);
            }
        } else if (allowedSections) {
            // Backward compatible behavior: no selectAll flag, just use payload
            staff.allowedSections = mergeAllowedSectionsWithDefaults(allowedSections);
        }

        // Update legacy activeHours if provided
        if (activeHours !== undefined) {
            staff.activeHours = activeHours || '';
        }

        // Account active hours
        const hoursEnabled =
            typeof accountActiveHoursEnabled === 'boolean'
                ? accountActiveHoursEnabled
                : staff.accountActiveHoursEnabled;

        if (typeof accountActiveHoursEnabled === 'boolean' || accountActiveHours) {
            const { valid, message, normalized } = validateAccountActiveHours(
                hoursEnabled,
                accountActiveHours || staff.accountActiveHours
            );

            if (!valid) {
                return res.status(400).json({
                    success: false,
                    message,
                    data: null
                });
            }

            staff.accountActiveHoursEnabled = hoursEnabled;
            staff.accountActiveHours = normalized;
        }

        // Enable / Active flags
        if (typeof isEnabled === 'boolean' || typeof isActive === 'boolean' || typeof enable === 'boolean') {
            const effectiveActive =
                typeof isActive === 'boolean'
                    ? isActive
                    : typeof isEnabled === 'boolean'
                        ? isEnabled
                        : typeof enable === 'boolean'
                            ? enable
                            : staff.isActive;
            staff.isEnabled = effectiveActive;
            staff.isActive = effectiveActive;
        }

        await staff.save();

        const staffData = staff.toObject();
        delete staffData.password;

        res.status(200).json({
            success: true,
            message: 'Staff account updated successfully',
            passwordStrength: staffData.passwordStrength,
            passwordMatch,
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

// @desc    Delete staff (Hard Delete)
// @route   DELETE /api/staff/:id
// @access  Private (Owner only)
const deleteStaff = async (req, res) => {
    const staffId = req.params.id;

    try {
        const staff = await Staff.findOneAndDelete({ _id: staffId, ownerRef: req.user._id });

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: 'Staff not found',
                data: null
            });
        }

        res.status(200).json({
            success: true,
            message: 'Staff deleted successfully',
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

// @desc    Staff login with userId + password and active hours validation
// @route   POST /api/staff/login
// @access  Public (staff portal)
const staffLogin = async (req, res) => {
    const { userId, password } = req.body;

    if (!userId || !password) {
        return res.status(400).json({
            success: false,
            message: 'User ID and password are required',
            data: null
        });
    }

    try {
        const staff = await Staff.findOne({ userId });
        if (!staff) {
            return res.status(400).json({
                success: false,
                message: 'Invalid User ID or Password',
                data: null
            });
        }

        const passwordValid = await bcrypt.compare(password, staff.password || '');
        if (!passwordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid User ID or Password',
                data: null
            });
        }

        // Active flag checks
        if (staff.isActive === false || staff.isEnabled === false) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been disabled, please contact the owner',
                data: null
            });
        }

        // Active hours check (if enabled)
        if (staff.accountActiveHoursEnabled) {
            const now = new Date();
            const dayIndex = now.getDay(); // 0 (Sun) - 6 (Sat)
            const dayName = DAYS_OF_WEEK[(dayIndex + 6) % 7]; // map: Sun(0)->Sunday, Mon(1)->Monday...

            const todayConfig =
                (staff.accountActiveHours || []).find((x) => x.day === dayName) || null;

            if (!todayConfig) {
                return res.status(403).json({
                    success: false,
                    message: 'Account Not Allowed To Login At This Time',
                    data: null
                });
            }

            const toMinutes = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };

            const nowMinutes = now.getHours() * 60 + now.getMinutes();
            const startMinutes = toMinutes(todayConfig.startTime);
            const endMinutes = toMinutes(todayConfig.endTime);

            if (nowMinutes < startMinutes || nowMinutes > endMinutes) {
                return res.status(403).json({
                    success: false,
                    message: 'Account Not Allowed To Login At This Time',
                    data: null
                });
            }
        }

        const token = generateToken(staff._id);

        const staffData = staff.toObject();
        delete staffData.password;

        res.status(200).json({
            success: true,
            message: 'Login successful',
            passwordStrength: staff.passwordStrength || 'weak',
            token,
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

module.exports = {
    createStaff,
    getStaffByName,
    getAllStaff,
    updateStaff,
    deleteStaff,
    staffLogin
};
