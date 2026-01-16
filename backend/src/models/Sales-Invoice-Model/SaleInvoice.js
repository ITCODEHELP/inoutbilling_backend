const mongoose = require('mongoose');
const PerformanceOptimization = require('../../utils/performanceOptimization');

const invoiceItemSchema = new mongoose.Schema({
    productName: { type: String, required: true, index: true },
    itemNote: { type: String },
    hsnSac: { type: String, index: true },
    qty: { type: Number, default: 0 },
    stockReference: { type: String },
    uom: { type: String },
    price: { type: Number, default: 0 },
    discountType: { type: String, enum: ['Percentage', 'Flat'], default: 'Flat' },
    discountValue: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    productGroup: { type: String, index: true }
}, { _id: false });

const saleInvoiceSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // Section 1: Customer Information
    customerInformation: {
        title: { type: String },
        ms: { type: String, required: [true, 'ms is required'] },
        address: { type: String },
        contactPerson: { type: String },
        phone: { type: String },
        gstinPan: { type: String },
        reverseCharge: { type: Boolean, default: false },
        shipTo: { type: String },
        placeOfSupply: { type: String, required: [true, 'placeOfSupply is required'] }
    },
    // Section 2: Invoice Details
    invoiceDetails: {
        invoiceType: { type: String, index: true },
        invoicePrefix: { type: String, index: true },
        invoiceNumber: { type: String, required: [true, 'invoiceNumber is required'], unique: true, index: true },
        invoicePostfix: { type: String },
        date: { type: Date, required: [true, 'date is required'], index: true },
        deliveryMode: { type: String },
        bankSelection: { type: String },
        hideBankDetails: { type: Boolean, default: false }
    },
    // Section 3: Product Items
    items: [invoiceItemSchema],

    // Section 4: Additional Charges
    additionalCharges: [{
        chargeName: { type: String },
        chargeAmount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 }
    }],

    // Add due date for outstanding calculations
    dueDate: { type: Date, index: true },

    // Totals and Summary
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

    paymentType: {
        type: String,
        required: [true, 'paymentType is required'],
        enum: ['CREDIT', 'CASH', 'CHEQUE', 'ONLINE'],
        index: true
    },

    // Conversions
    conversions: {
        convertedTo: [{
            docType: { type: String },
            docId: { type: mongoose.Schema.Types.ObjectId }
        }],
        convertedFrom: {
            docType: { type: String },
            docId: { type: mongoose.Schema.Types.ObjectId }
        }
    },

    // E-Way Bill
    eWayBill: {
        generated: { type: Boolean, default: false },
        eWayBillNumber: { type: String },
        eWayBillDate: { type: Date },
        eWayBillJson: { type: mongoose.Schema.Types.Mixed }
    },

    // Attachments
    attachments: [{
        fileName: { type: String },
        filePath: { type: String },
        fileSize: { type: Number },
        mimeType: { type: String }
    }],

    bankDetails: { type: String },
    termsTitle: { type: String },
    termsDetails: { type: String },

    // New Terms & Conditions structure if needed, but keeping old ones for compatibility
    termsAndConditions: {
        title: { type: String },
        text: { type: String }
    },

    additionalNotes: { type: String },
    documentRemarks: { type: String },
    printRemarksFlag: { type: Boolean, default: true },

    staff: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Staff',
        index: true
    },

    transportDetails: {
        lrNo: { type: String, index: true },
        vehicleNo: { type: String },
        transportName: { type: String }
    },

    deliveryChallanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryChallan',
        index: true
    }
}, {
    timestamps: true,
    // Optimized schema options for 100M+ users
    collection: 'saleinvoices',
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
saleInvoiceSchema.statics = {
    /**
     * Find invoices by user with lean projection
     * @param {string} userId - User ID
     * @param {Object} filters - Additional filters
     * @param {Array} fields - Fields to include
     * @returns {Promise<Array>} Invoice documents
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
            // Always filter by userId first for performance
            { $match: { userId: filters.userId } }
        ];

        // Add additional filters
        if (filters.customerVendor) {
            pipeline.push({
                $match: { 'customerInformation.ms': { $regex: filters.customerVendor, $options: 'i' } }
            });
        }

        if (filters.dateRange) {
            const dateFilter = {};
            if (filters.dateRange.from) dateFilter.$gte = new Date(filters.dateRange.from);
            if (filters.dateRange.to) dateFilter.$lte = new Date(filters.dateRange.to);
            pipeline.push({ $match: { 'invoiceDetails.date': dateFilter } });
        }

        // Add sorting
        if (options.sortBy) {
            const sort = {};
            sort[options.sortBy] = options.sortOrder === 'desc' ? -1 : 1;
            pipeline.push({ $sort: sort });
        }

        // Add pagination
        if (options.page && options.limit) {
            const skip = (options.page - 1) * options.limit;
            pipeline.push({ $skip: skip }, { $limit: options.limit });
        }

        return PerformanceOptimization.buildOptimizedPipeline(pipeline, { allowDiskUse: true });
    },

    /**
     * Create optimized indexes for 100M+ scale
     */
    async createOptimizedIndexes() {
        const indexDefinitions = [
            // Primary multi-tenant index
            { fields: { userId: 1 } },

            // Compound indexes for common queries
            { fields: { userId: 1, 'invoiceDetails.date': -1 } },
            { fields: { userId: 1, dueDate: 1 } },
            { fields: { userId: 1, 'customerInformation.ms': 1 } },
            { fields: { userId: 1, 'invoiceDetails.invoiceNumber': 1 } },
            { fields: { userId: 1, paymentType: 1 } },

            // Invoice-specific indexes
            { fields: { 'invoiceDetails.invoiceNumber': 1 }, options: { unique: true } },
            { fields: { 'invoiceDetails.date': -1 } },
            { fields: { dueDate: 1 } },
            { fields: { paymentType: 1 } },

            // Combined text search index (only one text index allowed per collection)
            {
                fields: {
                    'customerInformation.ms': 'text',
                    'customerInformation.gstinPan': 'text',
                    'items.productName': 'text'
                },
                options: { name: 'saleinvoice_text_search' }
            },
            { fields: { 'items.hsnSac': 1 } }
        ];

        return PerformanceOptimization.createOptimizedIndexes(this, indexDefinitions);
    }
};

// Instance methods for optimized operations
saleInvoiceSchema.methods = {
    /**
     * Convert invoice to lean object for API responses
     * @param {Array} fields - Fields to include
     * @returns {Object} Lean invoice object
     */
    toLeanObject(fields = []) {
        const invoiceObj = this.toObject();

        if (fields.length > 0) {
            const leanObj = {};
            fields.forEach(field => {
                if (invoiceObj[field] !== undefined) {
                    leanObj[field] = invoiceObj[field];
                }
            });
            return leanObj;
        }

        // Remove sensitive fields by default
        delete invoiceObj.__v;

        return invoiceObj;
    },

    /**
     * Calculate outstanding amount (for future payment tracking)
     * @returns {number} Outstanding amount
     */
    calculateOutstanding() {
        // In a real implementation, this would subtract payments
        return this.totals.grandTotal || 0;
    },

    /**
     * Calculate days overdue
     * @returns {number} Days overdue
     */
    calculateDaysOverdue() {
        if (!this.dueDate) return 0;

        const today = new Date();
        const dueDate = new Date(this.dueDate);
        const diffTime = today - dueDate;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return Math.max(0, diffDays);
    }
};

// Pre-save middleware for optimization
saleInvoiceSchema.pre('save', async function () {
    // Set due date if not provided (default to 30 days from invoice date)
    if (!this.dueDate && this.invoiceDetails.date) {
        const dueDate = new Date(this.invoiceDetails.date);
        dueDate.setDate(dueDate.getDate() + 30);
        this.dueDate = dueDate;
    }
});

// Post-save middleware for cache invalidation
saleInvoiceSchema.post('save', function (doc) {
    // Invalidate invoice cache entries
    if (global.cacheManager) {
        global.cacheManager.invalidatePattern(`invoice:${doc.userId}:*`);
        global.cacheManager.invalidatePattern(`invoice:${doc._id}:*`);
    }
});

module.exports = mongoose.model('SaleInvoice', saleInvoiceSchema);
