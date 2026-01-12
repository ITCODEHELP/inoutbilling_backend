const mongoose = require('mongoose');
const PerformanceOptimization = require('../../utils/performanceOptimization');

const userSchema = new mongoose.Schema({
    phone: {
        type: String,
        required: true,
        unique: true,
        index: true // Optimized for phone-based lookups
    },
    countryCode: {
        type: String,
        required: true,
        default: '+91',
        index: true // Optimized for country-based filtering
    },
    email: {
        type: String,
        unique: true,
        sparse: true, // Allows multiple null values
        index: true // Optimized for email-based lookups
    },
    userId: {
        type: String,
        unique: true,
        required: true,
        index: true // Optimized for userId-based lookups
    },
    password: {
        type: String
    },
    trackLoginLocation: {
        type: Boolean,
        default: false
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    eInvoiceEnabled: {
        type: Boolean,
        default: false
    },
    ewayBillUserId: {
        type: String
    },
    ewayBillPassword: {
        type: String
    },
    displayPhone: { type: String },
    fullName: { type: String },
    pan: { type: String },
    companyType: { type: String },
    landmark: { type: String },
    additionalLicense: { type: String },
    lutNo: { type: String },
    iecNo: { type: String },
    website: { type: String },
    gstAutoFill: { type: Boolean, default: false },
    updateGstOnPreviousInvoices: { type: Boolean, default: false },
    gstNumber: { type: String },
    companyName: { type: String },
    address: { type: String },
    pincode: { type: String },
    city: { type: String },
    state: { type: String },
    businessLogo: { type: String, default: '' },
    isEmailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String }
}, {
    timestamps: true,
    // Optimized schema options for 100M+ users
    collection: 'users',
    versionKey: false, // Disable __v for performance
    bufferCommands: false, // Disable mongoose buffering
    bufferMaxEntries: 0, // Disable buffer max entries
    // Optimized for read-heavy workloads
    read: 'secondaryPreferred',
    writeConcern: {
        w: 'majority',
        j: true
    }
});

// Static methods for optimized queries
userSchema.statics = {
    /**
     * Find user by phone with lean projection
     * @param {string} phone - User phone number
     * @param {Array} fields - Fields to include
     * @returns {Promise<Object>} User document
     */
    async findByPhoneLean(phone, fields = []) {
        const query = this.findOne({ phone });
        return PerformanceOptimization.buildLeanQuery(query, fields);
    },

    /**
     * Find user by userId with lean projection
     * @param {string} userId - User ID
     * @param {Array} fields - Fields to include
     * @returns {Promise<Object>} User document
     */
    async findByUserIdLean(userId, fields = []) {
        const query = this.findOne({ userId });
        return PerformanceOptimization.buildLeanQuery(query, fields);
    },

    /**
     * Create optimized indexes for 100M+ scale
     */
    async createOptimizedIndexes() {
        const indexDefinitions = [
            // Primary lookup indexes
            { fields: { phone: 1 }, options: { unique: true } },
            { fields: { userId: 1 }, options: { unique: true } },
            { fields: { email: 1 }, options: { unique: true, sparse: true } },

            // Compound indexes for common queries
            { fields: { phone: 1, countryCode: 1 } },
            { fields: { userId: 1, isVerified: 1 } },
            { fields: { createdAt: 1 } },

            // Text search for company name
            { fields: { companyName: 'text', gstNumber: 'text' } }
        ];

        return PerformanceOptimization.createOptimizedIndexes(this, indexDefinitions);
    }
};

// Instance methods for optimized operations
userSchema.methods = {
    /**
     * Convert user to lean object for API responses
     * @param {Array} fields - Fields to include
     * @returns {Object} Lean user object
     */
    toLeanObject(fields = []) {
        const userObj = this.toObject();

        if (fields.length > 0) {
            const leanObj = {};
            fields.forEach(field => {
                if (userObj[field] !== undefined) {
                    leanObj[field] = userObj[field];
                }
            });
            return leanObj;
        }

        // Remove sensitive fields by default
        delete userObj.password;
        delete userObj.__v;

        return userObj;
    }
};

// Pre-save middleware for optimization
userSchema.pre('save', function (next) {
    // Optimize for bulk operations
    if (this.isNew && this.constructor.bufferCommands === false) {
        return next();
    }
    next();
});

// Post-save middleware for cache invalidation
userSchema.post('save', function (doc) {
    // Invalidate user cache entries
    if (global.cacheManager) {
        global.cacheManager.invalidatePattern(`user:${doc._id}:*`);
        global.cacheManager.invalidatePattern(`user:${doc.phone}:*`);
        global.cacheManager.invalidatePattern(`user:${doc.userId}:*`);
    }
});

module.exports = mongoose.model('User', userSchema);
