const mongoose = require('mongoose');

/**
 * Staff Schema
 *
 * NOTE: This schema is designed to be backward compatible with
 * existing staff records. New fields have sane defaults so that
 * older documents continue to work without migration.
 */
const staffSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        // Schema-level validation: exactly 10 numeric digits
        validate: {
            validator: function (v) {
                return /^\d{10}$/.test(v || '');
            },
            message: 'Number must be having length 10'
        }
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: 'Invalid email address'
        }
    },
    password: {
        type: String,
        required: true
    },

    /**
     * Legacy enable flag (kept for backward compatibility).
     * New logic should primarily rely on `isActive`.
     */
    isEnabled: {
        type: Boolean,
        default: true
    },

    /**
     * NEW: Explicit active flag used for login checks.
     * When a staff is soft-deleted, this will be set to false.
     */
    isActive: {
        type: Boolean,
        default: true
    },

    /**
     * Legacy field (string-based storage of hours).
     * Preserved so older data does not break, but new logic
     * should use `accountActiveHoursEnabled` + `accountActiveHours`.
     */
    activeHours: {
        type: String,
        default: ''
    },

    /**
     * NEW: Whether account active hours restriction is enabled.
     */
    accountActiveHoursEnabled: {
        type: Boolean,
        default: false
    },

    /**
     * NEW: Detailed per-day active hours configuration.
     * Example:
     * [
     *   { day: 'Monday', startTime: '09:00', endTime: '18:30' },
     *   ...
     * ]
     */
    accountActiveHours: [
        {
            day: {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            },
            startTime: { type: String }, // HH:mm
            endTime: { type: String }    // HH:mm
        }
    ],

    /**
     * NEW: Allowed section permissions matrix.
     * Backward compatible: older records where this was an array
     * of strings will still be readable since `Mixed` accepts both.
     *
     * Expected new structure:
     * [
     *   {
     *     sectionName: 'Sale Invoice',
     *     permissions: { view: true, add: true, edit: true, remove: true }
     *   }
     * ]
     */
    allowedSections: {
        type: [mongoose.Schema.Types.Mixed],
        default: []
    },

    /**
     * NEW: Derived strength of the stored password.
     * One of: 'weak' | 'medium' | 'strong'
     */
    passwordStrength: {
        type: String,
        enum: ['weak', 'medium', 'strong'],
        default: 'weak'
    },

    /**
     * Owner linkage (unchanged).
     */
    ownerUserId: {
        type: String,
        required: true,
        index: true
    },
    ownerRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    /**
     * NEW: For audit – which owner created this staff.
     * Duplicates ownerRef for clarity, but kept optional
     * for backward compatibility.
     */
    createdByOwnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Staff', staffSchema);
