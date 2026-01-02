const SaleInvoice = require('../models/SaleInvoice');

// Helper for validation
const validateSaleInvoice = (data) => {
    const { customerInformation, invoiceDetails, items, paymentType, totals } = data;

    if (!customerInformation?.ms) return "M/S (Customer Name) is required";
    if (!customerInformation?.placeOfSupply) return "Place of Supply is required";
    if (!invoiceDetails?.invoiceNumber) return "Invoice Number is required";
    if (!invoiceDetails?.date) return "Date is required";
    if (!paymentType) return "Payment Type is required";

    if (!items || !Array.isArray(items) || items.length === 0) {
        return "Items array must not be empty";
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.productName) return `Product Name is required for item ${i + 1}`;
        if (!item.qty || item.qty <= 0) return `Quantity must be greater than 0 for item ${i + 1}`;
        if (!item.price || item.price <= 0) return `Price must be greater than 0 for item ${i + 1}`;
    }

    // Totals validation
    if (totals) {
        if (isNaN(totals.grandTotal)) return "Grand Total must be a number";
        if (isNaN(totals.totalTaxable)) return "Total Taxable must be a number";
        if (isNaN(totals.totalTax)) return "Total Tax must be a number";
    }

    return null;
};

// @desc    Create sale invoice
// @route   POST /api/sale-invoice/create
// @access  Private
const createInvoice = async (req, res) => {
    try {
        const error = validateSaleInvoice(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const {
            customerInformation,
            invoiceDetails,
            items,
            totals,
            paymentType,
            dueDate,
            bankDetails,
            termsTitle,
            termsDetails,
            additionalNotes,
            documentRemarks
        } = req.body;

        const invoice = await SaleInvoice.create({
            userId: req.user._id,
            customerInformation,
            invoiceDetails,
            items,
            totals,
            paymentType,
            dueDate,
            bankDetails,
            termsTitle,
            termsDetails,
            additionalNotes,
            documentRemarks
        });

        res.status(201).json({
            success: true,
            message: "Invoice saved successfully",
            invoiceId: invoice._id
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Invoice number must be unique" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create sale invoice and return for print
// @route   POST /api/sale-invoice/create-print
// @access  Private
const createInvoiceAndPrint = async (req, res) => {
    try {
        const error = validateSaleInvoice(req.body);
        if (error) {
            return res.status(400).json({ success: false, message: error });
        }

        const {
            customerInformation,
            invoiceDetails,
            items,
            totals,
            paymentType,
            dueDate,
            bankDetails,
            termsTitle,
            termsDetails,
            additionalNotes,
            documentRemarks
        } = req.body;

        const invoice = await SaleInvoice.create({
            userId: req.user._id,
            customerInformation,
            invoiceDetails,
            items,
            totals,
            paymentType,
            dueDate,
            bankDetails,
            termsTitle,
            termsDetails,
            additionalNotes,
            documentRemarks
        });

        res.status(201).json({
            success: true,
            message: "Invoice saved successfully",
            data: invoice
        });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: "Invoice number must be unique" });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all sale invoices
// @route   GET /api/sale-invoice
// @access  Private
const getInvoices = async (req, res) => {
    try {
        const invoices = await SaleInvoice.find({ userId: req.user._id });
        res.status(200).json(invoices);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get single sale invoice
// @route   GET /api/sale-invoice/:id
// @access  Private
const getInvoiceById = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        res.status(200).json(invoice);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete invoice
// @route   DELETE /api/sale-invoice/:id
// @access  Private
const deleteInvoice = async (req, res) => {
    try {
        const invoice = await SaleInvoice.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        res.status(200).json({ success: true, message: "Invoice deleted successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get sale invoice summary
// @route   GET /api/sale-invoice/summary
// @access  Private
const getInvoiceSummary = async (req, res) => {
    try {
        const { company, productGroup, invoiceType, paymentType, fromDate, toDate } = req.query;

        const query = { userId: req.user._id };

        if (company) query["customerInformation.ms"] = new RegExp(company, 'i');
        if (invoiceType) query["invoiceDetails.invoiceType"] = invoiceType;
        if (paymentType) query.paymentType = paymentType;

        if (fromDate || toDate) {
            query["invoiceDetails.date"] = {};
            if (fromDate) query["invoiceDetails.date"].$gte = new Date(fromDate);
            if (toDate) query["invoiceDetails.date"].$lte = new Date(toDate);
        }

        const summary = await SaleInvoice.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalCGST: { $sum: "$totals.totalCGST" },
                    totalSGST: { $sum: "$totals.totalSGST" },
                    totalIGST: { $sum: "$totals.totalIGST" },
                    totalTaxable: { $sum: "$totals.totalTaxable" },
                    totalValue: { $sum: "$totals.grandTotal" }
                }
            }
        ]);

        const result = summary.length > 0 ? summary[0] : {
            totalTransactions: 0,
            totalCGST: 0,
            totalSGST: 0,
            totalIGST: 0,
            totalTaxable: 0,
            totalValue: 0
        };

        delete result._id;

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createInvoice,
    createInvoiceAndPrint,
    getInvoices,
    getInvoiceById,
    deleteInvoice,
    getInvoiceSummary
};
