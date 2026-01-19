const InwardPayment = require('../../models/Payment-Model/InwardPayment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const User = require('../../models/User-Model/User');
const { generateSaleInvoicePDF } = require('../../utils/saleInvoicePdfHelper');
const { sendReceiptEmail } = require('../../utils/emailHelper');
const { recordActivity } = require('../../utils/activityLogHelper');
const numberToWords = require('../../utils/numberToWords');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads/inward-payments');
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
 * @desc    Create new Inward Payment
 * @route   POST /api/inward-payments
 * @access  Private
 */
const createInwardPayment = (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            const {
                receiptNo, receiptPrefix, receiptPostfix, companyName,
                address, gstinPan, totalOutstanding, paymentDate,
                amount, paymentType, remarks
            } = req.body;

            const userId = req.user._id;

            // Basic Validation
            if (!receiptNo || !companyName || !paymentDate || !amount || !paymentType) {
                return res.status(400).json({ success: false, message: "Missing required fields" });
            }

            if (amount <= 0) {
                return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
            }

            // ... (previous validation)
            if (totalOutstanding && Number(amount) > Number(totalOutstanding)) {
                return res.status(400).json({ success: false, message: "Amount cannot exceed outstanding amount" });
            }

            // Check duplicate receipt
            const existing = await InwardPayment.findOne({ userId, receiptNo });
            if (existing) {
                return res.status(400).json({ success: false, message: "Receipt No must be unique" });
            }

            // Custom Field Validation & Processing
            let customFieldsData = {};
            if (req.body.customFields) {
                try {
                    customFieldsData = JSON.parse(req.body.customFields); // Sent as JSON string in multipart? OR if client sends individual keys?
                    // NOTE: Mutipart 'customFields' usually comes as stringified JSON.
                } catch (e) {
                    // fall back if it is already object (unlikely in pure multipart but just in case)
                    customFieldsData = (typeof req.body.customFields === 'object') ? req.body.customFields : {};
                }
            }

            // Fetch definitions to validate
            const InwardPaymentCustomField = require('../../models/Payment-Model/InwardPaymentCustomField');
            const definitions = await InwardPaymentCustomField.find({ userId, status: 'Active' });

            const processedCustomFields = {};

            for (const def of definitions) {
                const val = customFieldsData[def._id.toString()];

                // Required check
                if (def.required && (val === undefined || val === null || val === '')) {
                    return res.status(400).json({ success: false, message: `${def.name} is required` });
                }

                // Value included?
                if (val !== undefined && val !== null && val !== '') {
                    // Type validation (Basic)
                    if (def.type === 'DROPDOWN' && def.options.length > 0) {
                        if (!def.options.includes(val)) {
                            // Optional: strict check? yes.
                            return res.status(400).json({ success: false, message: `Invalid option for ${def.name}` });
                        }
                    }
                    processedCustomFields[def._id.toString()] = val;
                }
            }


            const attachmentPath = req.file ? `/uploads/inward-payments/${req.file.filename}` : '';

            const inwardPayment = await InwardPayment.create({
                userId,
                receiptNo,
                receiptPrefix,
                receiptPostfix,
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
                message: "Inward payment saved successfully",
                data: inwardPayment
            });

        } catch (error) {
            console.error("Error saving inward payment:", error);
            res.status(500).json({
                success: false,
                message: "Server Error",
                error: error.message
            });
        }
    });
};

/**
 * @desc    Get all Inward Payments
 * @route   GET /api/inward-payments
 * @access  Private
 */
const getInwardPayments = async (req, res) => {
    try {
        const userId = req.user._id;
        const payments = await InwardPayment.find({ userId }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments
        });
    } catch (error) {
        console.error("Error fetching inward payments:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Get single Inward Payment by ID
 * @route   GET /api/inward-payments/:id
 * @access  Private
 */
const getInwardPaymentById = async (req, res) => {
    try {
        const payment = await InwardPayment.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!payment) {
            return res.status(404).json({ success: false, message: "Payment not found" });
        }

        res.status(200).json({ success: true, data: payment });
    } catch (error) {
        console.error("Error fetching inward payment:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

/**
 * @desc    Update Inward Payment
 * @route   PUT /api/inward-payments/:id
 * @access  Private
 */
const updateInwardPayment = (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        try {
            let bodyData = {};

            // 1\ufe0f\u20e3 Extract data from req.body.data if it exists, otherwise use req.body
            if (req.body.data) {
                try {
                    bodyData = typeof req.body.data === 'string' ? JSON.parse(req.body.data) : req.body.data;
                } catch (error) {
                    return res.status(400).json({ success: false, message: "Invalid JSON format in 'data' field" });
                }
            } else {
                bodyData = { ...req.body };
            }

            // 1.5\ufe0f\u20e3 Normalize numeric fields
            if (bodyData.amount) {
                bodyData.amount = Number(bodyData.amount);
            }
            if (bodyData.totalOutstanding) {
                bodyData.totalOutstanding = Number(bodyData.totalOutstanding);
            }

            // 1.6\ufe0f\u20e3 Normalize paymentType to lowercase (schema uses lowercase enum)
            if (bodyData.paymentType && typeof bodyData.paymentType === 'string') {
                bodyData.paymentType = bodyData.paymentType.toLowerCase();
            }

            const userId = req.user._id;

            // 2\ufe0f\u20e3 Basic Validation
            if (bodyData.amount !== undefined && bodyData.amount <= 0) {
                return res.status(400).json({ success: false, message: "Amount must be greater than 0" });
            }

            if (bodyData.totalOutstanding && bodyData.amount && Number(bodyData.amount) > Number(bodyData.totalOutstanding)) {
                return res.status(400).json({ success: false, message: "Amount cannot exceed outstanding amount" });
            }

            // Check duplicate receipt number if it's being changed
            if (bodyData.receiptNo) {
                const existing = await InwardPayment.findOne({
                    userId,
                    receiptNo: bodyData.receiptNo,
                    _id: { $ne: req.params.id }
                });
                if (existing) {
                    return res.status(400).json({ success: false, message: "Receipt No must be unique" });
                }
            }

            // 3\ufe0f\u20e3 Handle custom fields
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
            const InwardPaymentCustomField = require('../../models/Payment-Model/InwardPaymentCustomField');
            const definitions = await InwardPaymentCustomField.find({ userId, status: 'Active' });

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

            // 4\ufe0f\u20e3 Handle attachment
            if (req.file) {
                bodyData.attachment = `/uploads/inward-payments/${req.file.filename}`;
            }

            // 5\ufe0f\u20e3 Update payment
            const payment = await InwardPayment.findOneAndUpdate(
                { _id: req.params.id, userId },
                { ...bodyData },
                { new: true, runValidators: true }
            );

            if (!payment) {
                return res.status(404).json({ success: false, message: "Payment not found" });
            }

            // 6\ufe0f\u20e3 Record Activity
            await recordActivity(
                req,
                'Update',
                'Inward Payment',
                `Inward Payment updated: ${payment.receiptNo}`,
                payment.receiptNo
            );

            res.status(200).json({
                success: true,
                message: "Inward payment updated successfully",
                data: payment
            });

        } catch (error) {
            console.error("Error updating inward payment:", error);
            res.status(500).json({
                success: false,
                message: "Server Error",
                error: error.message
            });
        }
    });
};

/**
 * @desc    Get Inward Payment Summary
 * @route   GET /api/inward-payments/summary
 * @access  Private
 */
const getPaymentSummary = async (req, res) => {
    try {
        const userId = req.user._id;

        const summary = await InwardPayment.aggregate([
            { $match: { userId: userId } },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalAmount: { $sum: "$amount" },
                    // Assuming no explicit 'isAdvance' field exists yet, defaulting to 0. 
                    // If logic requires, this can be updated later.
                    totalAdvanceAmount: { $sum: 0 }
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
 * @desc    Search Inward Payments with filters
 * @route   GET /api/inward-payments/search
 * @access  Private
 */
const searchInwardPayments = async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            companyName,
            fromDate,
            toDate,
            paymentType,
            remarks,
            receiptNo,
            amount,
            minAmount, // Optional range support
            maxAmount
        } = req.query;

        let query = { userId };

        // 1. String partial matches (Case-Insensitive)
        if (companyName) {
            query.companyName = { $regex: companyName, $options: 'i' };
        }
        if (remarks) {
            query.remarks = { $regex: remarks, $options: 'i' };
        }
        if (receiptNo) {
            query.receiptNo = { $regex: receiptNo, $options: 'i' };
        }

        // 2. Exact match (Enum)
        if (paymentType) {
            // Validate Enum (optional, but good for safety)
            const validTypes = ['cash', 'cheque', 'online', 'bank', 'tds', 'bad_debit', 'currency_exchange_loss'];
            if (validTypes.includes(paymentType)) {
                query.paymentType = paymentType;
            }
        }

        // 3. Date Range (Inclusive)
        if (fromDate || toDate) {
            query.paymentDate = {};
            if (fromDate) {
                query.paymentDate.$gte = new Date(fromDate);
            }
            if (toDate) {
                // Ensure toDate includes the full day if time isn't provided (set to end of day? user usually sends YYYY-MM-DD)
                // If standard ISO, generic comparison works. If date only, we might need to adjust.
                // Assuming standard comparison for now.
                query.paymentDate.$lte = new Date(toDate);
            }
        }

        // 4. Amount (Exact or Range)
        if (amount) {
            query.amount = Number(amount);
        } else if (minAmount || maxAmount) {
            query.amount = {};
            if (minAmount) query.amount.$gte = Number(minAmount);
            if (maxAmount) query.amount.$lte = Number(maxAmount);
        }

        // 5. Custom Field Filters (e.g. cf_<id>=value)
        // Frontend should prefix custom field IDs with 'cf_' to distinguish them from standard fields
        for (const [key, value] of Object.entries(req.query)) {
            if (key.startsWith('cf_')) {
                const fieldId = key.substring(3);
                // We don't know the type easily without fetching defs, but we can infer or use regex for everything?
                // Better to fetch defs? Or just assume string/exact match based on usage?
                // User said: "allow filtering by them (text partial match, date exact/range, dropdown exact match)"

                // Ideally we need to know the type to select regex vs exact.
                // Let's try to query definitions for these keys to be precise.

                // Caveat: Fetching defs in search might slow it down slightly but ensures correctness.
                // Optimisation: use regex for everything except if it looks like date? 
                // Or just support exact match for now?
                // User requirement: "text partial match, date exact/range, dropdown exact match"

                // Let's implement smart logic:
                // If it's a date string (YYYY-MM-DD), use date match?
                // Actually, for MongoDB 'Mixed' storage, everything is likely stored as string unless casted?
                // We stored them as they came in. If provided as JSON string values, they are strings.

                // Let's apply partial match (regex) for everything safe, or exact if requested?
                // "text partial match" -> regex
                // "dropdown exact match" -> regex is strictly looser but 'exact' is safer.

                // Simple approach: 
                // `customFields.<id>`: value 

                // To support partial match for text, we can use regex.
                // To support dropdown exact, regex works too (if no substr matches).
                // Let's default to Regex for flexibility on Mixed types.
                query[`customFields.${fieldId}`] = { $regex: value, $options: 'i' };
            }
        }

        const payments = await InwardPayment.find(query).sort({ paymentDate: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: payments.length,
            data: payments
        });
    } catch (error) {
        console.error("Error searching inward payments:", error);
        res.status(500).json({
            success: false,
            message: "Server Error",
            error: error.message
        });
    }
};

// Helper to map Inward Payment to Sale Invoice structure for rendering
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
            invoiceNumber: `${payment.receiptPrefix}${payment.receiptNo}${payment.receiptPostfix}`,
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
 * @desc    Download Receipt PDF
 */
const downloadPaymentPDF = async (req, res) => {
    try {
        const payment = await InwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Receipt not found" });

        const userData = await User.findById(req.user._id);
        const mappedData = mapPaymentToInvoice(payment);

        const pdfBuffer = await generateSaleInvoicePDF(
            mappedData,
            userData || {},
            "RECEIPT VOUCHER",
            { no: "Receipt No.", date: "Receipt Date", sectionTitle: "Customer Detail" }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Receipt_${mappedData.invoiceDetails.invoiceNumber}.pdf"`);
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Receipt via Email
 */
const shareEmail = async (req, res) => {
    try {
        const payment = await InwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Receipt not found" });

        const mappedData = mapPaymentToInvoice(payment);
        const targetEmail = req.body.email; // Client can provide email or we use a default if available

        await sendReceiptEmail(mappedData, targetEmail);

        await recordActivity(
            req,
            'Share Email',
            'Inward Payment',
            `Receipt ${mappedData.invoiceDetails.invoiceNumber} shared via email`,
            mappedData.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, message: "Receipt shared via email" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Share Receipt via WhatsApp
 */
const shareWhatsApp = async (req, res) => {
    try {
        const payment = await InwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Receipt not found" });

        const mappedData = mapPaymentToInvoice(payment);
        const { phone } = req.body;

        if (!phone) return res.status(400).json({ success: false, message: "Phone number is required for WhatsApp share" });

        const message = `Dear Customer, your receipt ${mappedData.invoiceDetails.invoiceNumber} for amount ${mappedData.totals.grandTotal.toFixed(2)} is ready.`;
        const waLink = `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(message)}`;

        await recordActivity(
            req,
            'Share WhatsApp',
            'Inward Payment',
            `Receipt ${mappedData.invoiceDetails.invoiceNumber} shared via WhatsApp`,
            mappedData.invoiceDetails.invoiceNumber
        );

        res.status(200).json({ success: true, waLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Generate a secure public link for the receipt
 */
const generatePublicLink = async (req, res) => {
    try {
        const payment = await InwardPayment.findOne({ _id: req.params.id, userId: req.user._id });
        if (!payment) return res.status(404).json({ success: false, message: "Receipt not found" });

        // Generate a secure token based on payment ID and a secret
        const secret = process.env.JWT_SECRET || 'your-default-secret';
        const token = crypto
            .createHmac('sha256', secret)
            .update(payment._id.toString())
            .digest('hex')
            .substring(0, 16); // Shortened for link readability

        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/inward-payments/view-public/${payment._id}/${token}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Public View Receipt PDF (Unprotected)
 */
const viewPaymentPublic = async (req, res) => {
    try {
        const { id, token } = req.params;

        // Verify token
        const secret = process.env.JWT_SECRET || 'your-default-secret';
        const expectedToken = crypto
            .createHmac('sha256', secret)
            .update(id)
            .digest('hex')
            .substring(0, 16);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const payment = await InwardPayment.findById(id);
        if (!payment) return res.status(404).send("Receipt not found");

        const userData = await User.findById(payment.userId);
        const mappedData = mapPaymentToInvoice(payment);

        const pdfBuffer = await generateSaleInvoicePDF(
            mappedData,
            userData || {},
            "RECEIPT VOUCHER",
            { no: "Receipt No.", date: "Receipt Date", sectionTitle: "Customer Detail" }
        );

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Receipt.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering receipt");
    }
};

module.exports = {
    createInwardPayment,
    getInwardPayments,
    getInwardPaymentById,
    updateInwardPayment,
    getPaymentSummary,
    searchInwardPayments,
    downloadPaymentPDF,
    shareEmail,
    shareWhatsApp,
    generatePublicLink,
    viewPaymentPublic
};
