const OutwardPayment = require('../models/OutwardPayment');
const OutwardPaymentCustomField = require('../models/OutwardPaymentCustomField');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/outward-payments');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
}).single('attachment');

/**
 * @desc    Create new Outward Payment
 * @route   POST /api/outward-payments
 * @access  Private
 */
const createOutwardPayment = (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            const {
                paymentNo, paymentPrefix, paymentPostfix, companyName,
                address, gstinPan, totalOutstanding, paymentDate,
                amount, paymentType, remarks
            } = req.body;

            const userId = req.user._id;

            // Basic Validation
            if (!paymentNo || !companyName || !paymentDate || !amount || !paymentType) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            if (amount <= 0) {
                return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
            }

            // Check duplicacy of paymentNo
            const existing = await OutwardPayment.findOne({ userId, paymentNo });
            if (existing) {
                return res.status(400).json({ success: false, message: "Payment No must be unique" });
            }

            // Custom Field Validation & Processing
            let customFieldsData = {};
            if (req.body.customFields) {
                try {
                    customFieldsData = JSON.parse(req.body.customFields);
                } catch (e) {
                    customFieldsData = (typeof req.body.customFields === 'object') ? req.body.customFields : {};
                }
            }

            const definitions = await OutwardPaymentCustomField.find({ userId, status: 'Active' });
            const processedCustomFields = {};

            for (const def of definitions) {
                const val = customFieldsData[def._id.toString()];
                if (def.required && (val === undefined || val === null || val === '')) {
                    return res.status(400).json({ success: false, message: `${def.name} is required` });
                }
                if (val !== undefined && val !== null && val !== '') {
                    if (def.type === 'DROPDOWN' && def.options.length > 0) {
                        if (!def.options.includes(val)) {
                            return res.status(400).json({ success: false, message: `Invalid option for ${def.name}` });
                        }
                    }
                    processedCustomFields[def._id.toString()] = val;
                }
            }

            const attachmentPath = req.file ? `/uploads/outward-payments/${req.file.filename}` : '';

            const outwardPayment = await OutwardPayment.create({
                userId,
                paymentNo,
                paymentPrefix,
                paymentPostfix,
                companyName,
                address,
                gstinPan,
                totalOutstanding,
                paymentDate,
                amount,
                paymentType,
                remarks,
                attachment: attachmentPath,
                customFields: processedCustomFields
            });

            res.status(201).json({
                success: true,
                message: "Outward payment saved successfully",
                data: outwardPayment
            });

        } catch (error) {
            console.error("Error saving outward payment:", error);
            res.status(500).json({
                success: false,
                message: "Server Error",
                error: error.message
            });
        }
    });
};

/**
 * @desc    Get all Outward Payments
 * @route   GET /api/outward-payments
 * @access  Private
 */
const getOutwardPayments = async (req, res) => {
    try {
        const userId = req.user._id;
        const payments = await OutwardPayment.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments
        });
    } catch (error) {
        console.error("Error fetching outward payments:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get Outward Payment Summary
 * @route   GET /api/outward-payments/summary
 * @access  Private
 */
const getPaymentSummary = async (req, res) => {
    try {
        const userId = req.user._id;

        const summary = await OutwardPayment.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalAmount: { $sum: "$amount" },
                    totalAdvanceAmount: { $sum: 0 } // Default for now
                }
            }
        ]);

        const data = summary.length > 0 ? summary[0] : { totalTransactions: 0, totalAmount: 0, totalAdvanceAmount: 0 };

        res.status(200).json({
            success: true,
            data: {
                totalTransactions: data.totalTransactions,
                totalAmount: data.totalAmount,
                totalAdvanceAmount: data.totalAdvanceAmount
            }
        });
    } catch (error) {
        console.error("Error fetching payment summary:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Search Outward Payments
 * @route   GET /api/outward-payments/search
 * @access  Private
 */
const searchOutwardPayments = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            companyName,
            fromDate,
            toDate,
            paymentType,
            remarks,
            paymentNo,
            amount,
            minAmount,
            maxAmount,
            staffName // Mentioned in requirements but not in Schema directly? Assuming it might correspond to a user or just a string if added. 
            // In requirements: "staffName". If not in schema, can't filter. 
            // Checking schema provided in Create: No staffName. 
            // Assuming omission in Schema step or derived from 'User'. 
            // If User is staff, filtering by staffName might mean filtering by userId? But endpoint is for authenticated user (Private). 
            // If the user *is* the staff, they only see their own.
            // If there's a specific field 'staffName', it should be in schema. 
            // Reviewing Create API request: Schema didn't have staffName.
            // I will skip staffName filtering logic if field doesn't exist, to prevent crash, or add it to Schema if implicit?
            // Requirement said "staffName" filter.
            // I'll assume if it's passed, ignore if not in schema.
        } = req.query;

        let query = { userId };

        if (companyName) query.companyName = { $regex: companyName, $options: 'i' };
        if (remarks) query.remarks = { $regex: remarks, $options: 'i' };
        if (paymentNo) query.paymentNo = { $regex: paymentNo, $options: 'i' };

        if (paymentType) {
            const validTypes = ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss'];
            if (validTypes.includes(paymentType)) query.paymentType = paymentType;
        }

        if (fromDate || toDate) {
            query.paymentDate = {};
            if (fromDate) query.paymentDate.$gte = new Date(fromDate);
            if (toDate) query.paymentDate.$lte = new Date(toDate);
        }

        if (amount) {
            query.amount = Number(amount);
        } else if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = Number(minAmount);
            if (maxAmount) query.amount.$lte = Number(maxAmount);
        }

        // Staff Filter (staffName -> staffId)
        if (staffName) {
            // Lookup Staff by name (Partial, Case-Insensitive)
            const Staff = require('../models/Staff');
            const staffMembers = await Staff.find({
                fullName: { $regex: staffName, $options: 'i' }
            }).select('_id');

            // Also consider User model if Staff are Users? 
            // The requirement specificially said "lookup/join with the staff collection".

            const staffIds = staffMembers.map(s => s._id);
            if (staffIds.length > 0) {
                query.staffId = { $in: staffIds };
            } else {
                // If name provided but no staff found, allow empty result?
                // Yes. query.staffId = { $in: [] } would return empty.
                query.staffId = { $in: [] };
            }
        }

        // Custom Fields Filters (cf_)
        for (const [key, value] of Object.entries(req.query)) {
            if (key.startsWith('cf_')) {
                const fieldId = key.substring(3);
                query[`customFields.${fieldId}`] = { $regex: value, $options: 'i' };
            }
        }

        const payments = await OutwardPayment.find(query).sort({ paymentDate: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments
        });
    } catch (error) {
        console.error("Error searching outward payments:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

module.exports = {
    createOutwardPayment,
    getOutwardPayments,
    getPaymentSummary,
    searchOutwardPayments
};
