const mongoose = require('mongoose');
const PerformanceOptimization = require('../../utils/performanceOptimization');

const jobWorkItemSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    productGroup: { type: String },
    itemNote: { type: String },
    hsnSac: { type: String },
    qty: { type: Number, default: 0 },
    uom: { type: String },
    price: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

const shippingAddressSchema = new mongoose.Schema({
    street: { type: String },
    landmark: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    pincode: { type: String },
    distance: { type: Number, default: 0 }
});

const jobWorkSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Section 1: Customer Information
    customerInformation: {
        ms: { type: String, required: [true, 'ms is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        placeOfSupply: { type: String, required: [true, 'placeOfSupply is required'] }
    },
    useSameShippingAddress: { type: Boolean, default: true },
    shippingAddress: shippingAddressSchema,

    // Section 2: Job Work Details
    jobWorkDetails: {
        jobWorkPrefix: { type: String },
        jobWorkNumber: { type: String },
        jobWorkPostfix: { type: String },
        date: { type: Date, required: [false, 'date is required'] },
        status: {
            type: String,
            default: 'New'
        }
    },
    // Section 3: Product Items
    items: [jobWorkItemSchema],
    // Additional Charges
    additionalCharges: [{
        name: String,
        amount: { type: Number, default: 0 },
        tax: { type: Number, default: 0 }
    }],
    // Totals
    totals: {
        totalInvoiceValue: { type: Number, default: 0 },
        totalTaxable: { type: Number, default: 0 },
        totalTax: { type: Number, default: 0 },
        totalCGST: { type: Number, default: 0 },
        totalSGST: { type: Number, default: 0 },
        totalIGST: { type: Number, default: 0 },
        roundOff: { type: Number, default: 0 },
        grandTotal: { type: Number, default: 0 },
        totalInWords: { type: String }
    },
    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        default: null
    },
    branch: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    bankDetails: { type: mongoose.Schema.Types.Mixed },
    termsTitle: { type: String },
    termsDetails: { type: [String] },
    documentRemarks: { type: String },
    shareOnEmail: { type: Boolean, default: false },
    customFields: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    attachments: [{
        fileName: { type: String, required: true },
        filePath: { type: String, required: true },
        fileSize: { type: Number, required: true },
        mimeType: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
    }]
}, {
    timestamps: true
});

jobWorkSchema.index({ userId: 1, 'jobWorkDetails.jobWorkNumber': 1 }, { unique: true });

// Static methods for optimized queries
jobWorkSchema.statics = {
    /**
     * Find Job Works by user with lean projection
     * @param {string} userId - User ID
     * @param {Object} filters - Additional filters
     * @param {Array} fields - Fields to include
     * @returns {Promise<Array>} Job Work documents
     */
    async findByUserLean(userId, filters = {}, fields = []) {
        const query = this.find({ userId, ...filters });
        return PerformanceOptimization.buildLeanQuery(query, fields);
    },

    /**
     * Create optimized aggregation pipeline for reports
     * @param {Object} filters - Filter criteria
     * @param {Object} options - Query options
     * @returns {Array} Optimized aggregation pipeline
     */
    buildOptimizedReportPipeline(filters, options) {
        const pipeline = [
            { $match: { userId: filters.userId } }
        ];

        if (filters.customerName) {
            pipeline.push({
                $match: { 'customerInformation.ms': { $regex: filters.customerName, $options: 'i' } }
            });
        }

        if (filters.dateRange) {
            const dateFilter = {};
            if (filters.dateRange.from) dateFilter.$gte = new Date(filters.dateRange.from);
            if (filters.dateRange.to) dateFilter.$lte = new Date(filters.dateRange.to);
            pipeline.push({ $match: { 'jobWorkDetails.date': dateFilter } });
        }

        if (options.sortBy) {
            const sort = {};
            sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
            pipeline.push({ $sort: sort });
        }

        if (options.page && options.limit) {
            const skip = (options.page - 1) * options.limit;
            pipeline.push({ $skip: skip }, { $limit: options.limit });
        }

        return PerformanceOptimization.buildOptimizedPipeline(pipeline, { allowDiskUse: true });
    },

    /**
     * Create optimized indexes for scale
     */
    async createOptimizedIndexes() {
        const indexDefinitions = [
            { fields: { userId: 1 } },
            { fields: { userId: 1, 'jobWorkDetails.date': -1 } },
            { fields: { userId: 1, 'customerInformation.ms': 1 } },
            { fields: { userId: 1, 'jobWorkDetails.jobWorkNumber': 1 } },
            { fields: { userId: 1, 'jobWorkDetails.status': 1 } },
            { fields: { 'jobWorkDetails.jobWorkNumber': 1 }, options: { unique: true } },
            {
                fields: {
                    'customerInformation.ms': 'text',
                    'jobWorkDetails.jobWorkNumber': 'text',
                    'items.productName': 'text'
                },
                options: { name: 'jobwork_text_search' }
            }
        ];

        return PerformanceOptimization.createOptimizedIndexes(this, indexDefinitions);
    }
};

// Instance methods for optimized operations
jobWorkSchema.methods = {
    toLeanObject(fields = []) {
        const docObj = this.toObject();
        if (fields.length > 0) {
            const leanObj = {};
            fields.forEach(field => {
                if (docObj[field] !== undefined) leanObj[field] = docObj[field];
            });
            return leanObj;
        }
        delete docObj.__v;
        return docObj;
    }
};

// Post-save middleware for cache invalidation
jobWorkSchema.post('save', function (doc) {
    if (global.cacheManager) {
        global.cacheManager.invalidatePattern(`jobwork:${doc.userId}:*`);
        global.cacheManager.invalidatePattern(`jobwork:${doc._id}:*`);
    }
});

module.exports = mongoose.model('JobWork', jobWorkSchema);
