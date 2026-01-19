const OutwardPayment = require('../../models/Payment-Model/OutwardPayment');
const OutwardPaymentCustomField = require('../../models/Payment-Model/OutwardPaymentCustomField');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const User = require('../../models/User-Model/User');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { sendOutwardPaymentEmail } = require('../../utils/emailHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const numberToWords = require('../../utils/numberToWords');

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
 * @desc    Get single Outward Payment by ID
 * @route   GET /api/outward-payments/:id
 * @access  Private
 */
const getOutwardPaymentById = async (req, res) => {
    try {
        const payment = await OutwardPayment.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        console.error("Error fetching outward payment:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Update Outward Payment
 * @route   PUT /api/outward-payments/:id
 * @access  Private
 */
const updateOutwardPayment = (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            let bodyData = {};

            // 1️⃣ Extract data from req.body.data if it exists, otherwise use req.body
            if (req.body.data) {
                try {
                    bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
                } catch (error) {
                    return res.status(400).json({ success: false, message: "Invalid JSON format in 'data' field" });
                }
            } else {
                bodyData = { ...req.body };
            }

            // 1.5️⃣ Normalize numeric fields
            if (bodyData.amount) {
                bodyData.amount = Number(bodyData.amount);
            }
            if (bodyData.totalOutstanding) {
                bodyData.totalOutstanding = Number(bodyData.totalOutstanding);
            }

            // 1.6️⃣ Normalize paymentType to lowercase (schema uses lowercase enum)
            if (bodyData.paymentType && typeof bodyData.paymentType === 'string') {
                bodyData.paymentType = bodyData.paymentType.toLowerCase();
            }

            const userId = req.user._id;

            // 2️⃣ Basic Validation
            if (bodyData.amount !== undefined && bodyData.amount <= 0) {
                return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
            }

            // Check duplicate payment number if it's being changed
            if (bodyData.paymentNo) {
                const existing = await OutwardPayment.findOne({
                    userId,
                    paymentNo: bodyData.paymentNo,
                    _id: { $ne: req.params.id }
                });
                if (existing) {
                    return res.status(400).json({ success: false, message: "Payment No must be unique" });
                }
            }

            // 3️⃣ Handle custom fields
            let customFieldsData = {};
            if (bodyData.customFields) {
                try {
                    customFieldsData = typeof bodyData.customFields === 'string'
                        ? JSON.parse(bodyData.customFields)
                        : bodyData.customFields;
                } catch (e) {
                    customFieldsData = {};
                }
            }

            // Fetch definitions to validate
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

            bodyData.customFields = processedCustomFields;

            // 4️⃣ Handle attachment
            if (req.file) {
                bodyData.attachment = `/uploads/outward-payments/${req.file.filename}`;
            }

            // 5️⃣ Update payment
            const payment = await OutwardPayment.findOneAndUpdate(
                { _id: req.params.id, userId },
                { ...bodyData },
                { new: true, runValidators: true }
            );

            if (!payment) {
                return res.status(404).json({ success: false, message: "Payment not found" });
            }

            // 6️⃣ Record Activity
            await recordActivity(
                req,
                'Update',
                'Outward Payment',
                `Outward Payment updated: ${payment.paymentNo}`,
                payment.paymentNo
            );

            res.status(200).json({
                success: true,
                message: "Outward payment updated successfully",
                data: payment
            });

        } catch (error) {
            console.error("Error updating outward payment:", error);
            res.status(500).json({
                success: false,
                message: "Server Error",
                error: error.message
            });
        }
    });
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

// Helper to map Outward Payment to Sale Invoice structure for rendering
const mapPaymentToInvoice = (payment) => {
    const pType = payment.paymentType.toUpperCase();
    let mappedPType = 'ONLINE';
    if (pType === 'CASH') mappedPType = 'CASH';
    if (pType === 'CHEQUE') mappedPType = 'CHEQUE';

    return {
        userId: payment.userId,
        customerInformation: {
            ms: payment.companyName,
            address: payment.address,
            phone: "-",
            gstinPan: payment.gstinPan,
            placeOfSupply: "-"
        },
        invoiceDetails: {
            invoiceNumber: `${payment.paymentPrefix}${payment.paymentNo}${payment.paymentPostfix}`,
            date: payment.paymentDate
        },
        items: [
            {
                productName: `Account :\n  ${payment.companyName}\n\nThrough :\n  ${payment.paymentType.toUpperCase()}`,
                qty: 1,
                price: payment.amount,
                total: payment.amount,
                hsnSac: "-"
            }
        ],
        totals: {
            grandTotal: payment.amount,
            totalInWords: numberToWords(payment.amount)
        },
        paymentType: mappedPType
    };
};

/**
 * @desc    Download Payment PDF
 */
const downloadPaymentPDF = async (req, res) => {
    try {
        const payment = await OutwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        const userData = await User.findById(req.user._id);
        const mappedData = mapPaymentToInvoice(payment);

        const pdfBuffer = await generateSaleInvoicePDF(
            mappedData,
            userData || {},
            "PAYMENT VOUCHER",
            { no: "Payment No.", date: "Payment Date", sectionTitle: "Vendor Details" }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Payment_${mappedData.invoiceDetails.invoiceNumber}.pdf"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Payment via Email
 */
const shareEmail = async (req, res) => {
    try {
        const payment = await OutwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        const mappedData = mapPaymentToInvoice(payment);
        const targetEmail = req.body.email;

        await sendOutwardPaymentEmail(mappedData, targetEmail);

        await recordActivity(
            req,
            'Share Email',
            'Outward Payment',
            `Payment ${mappedData.invoiceDetails.invoiceNumber} shared via email`,
            mappedData.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Payment shared via email" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Payment via WhatsApp
 */
const shareWhatsApp = async (req, res) => {
    try {
        const payment = await OutwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        const mappedData = mapPaymentToInvoice(payment);
        const { phone } = req.body;

        if (!phone) return res.status(400).json({ success: false, message: "Phone number is required for WhatsApp share" });

        const message = `Dear Vendor, our payment ${mappedData.invoiceDetails.invoiceNumber} for amount ${mappedData.totals.grandTotal.toFixed(2)} is ready.`;
        const waLink = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;

        await recordActivity(
            req,
            'Share WhatsApp',
            'Outward Payment',
            `Payment ${mappedData.invoiceDetails.invoiceNumber} shared via WhatsApp`,
            mappedData.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, waLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Generate a secure public link for the payment
 */
const generatePublicLink = async (req, res) => {
    try {
        const payment = await OutwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Payment not found" });

        const secret = process.env.JWT_SECRET || 'your-default-secret';
        const token = crypto
            .createHmac('sha256', secret)
            .update(payment._id.toString())
            .digest('hex')
            .substring(0, 16);

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/outward-payments/view-public/${payment._id}/${token}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Public View Payment PDF (Unprotected)
 */
const viewPaymentPublic = async (req, res) => {
    try {
        const { id, token } = req.params;

        const secret = process.env.JWT_SECRET || 'your-default-secret';
        const expectedToken = crypto
            .createHmac('sha256', secret)
            .update(id)
            .digest('hex')
            .substring(0, 16);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const payment = await OutwardPayment.findById(id);
        if (!payment) return res.status(404).send("Payment not found");

        const userData = await User.findById(payment.userId);
        const mappedData = mapPaymentToInvoice(payment);

        const pdfBuffer = await generateSaleInvoicePDF(
            mappedData,
            userData || {},
            "PAYMENT VOUCHER",
            { no: "Payment No.", date: "Payment Date", sectionTitle: "Vendor Details" }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Payment.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering payment voucher");
    }
};

module.exports = {
    createOutwardPayment,
    getOutwardPayments,
    getOutwardPaymentById,
    updateOutwardPayment,
    getPaymentSummary,
    searchOutwardPayments,
    downloadPaymentPDF,
    shareEmail,
    shareWhatsApp,
    generatePublicLink,
    viewPaymentPublic
};
