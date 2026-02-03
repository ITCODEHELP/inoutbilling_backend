const nodemailer = require('nodemailer');
const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { generateJobWorkPDF } = require('./jobWorkPdfHelper');
const { generatePurchaseInvoicePDF } = require('./purchaseInvoicePdfHelper');
const { generateReceiptVoucherPDF } = require('./receiptPdfHelper');
const User = require('../models/User-Model/User');
const { getSelectedPrintTemplate } = require('./documentHelper');

const sendInvoiceEmail = async (invoices, email, isPurchase = false, options = { original: true }, docType = 'Sale Invoice') => {
    try {
        if (!email) {
            console.log(`No ${isPurchase ? 'vendor' : 'customer'} email provided, skipping email share.`);
            return;
        }

        const items = Array.isArray(invoices) ? invoices : [invoices];
        if (items.length === 0) return;

        const userData = await User.findById(items[0].userId);
        let pdfBuffer;
        if (isPurchase) {
            // Use professional PDF helper for purchase invoices
            pdfBuffer = await generatePurchaseInvoicePDF(items, userData || {}, options);
        } else if (docType === 'Job Work') {
            pdfBuffer = await generateJobWorkPDF(items, userData || {}, options);
        } else {
            // Use specialized Sale Invoice PDF helper with professional template (supports Quotation too)
            const printConfig = await getSelectedPrintTemplate(items[0].userId, docType, items[0].branch);
            pdfBuffer = await generateSaleInvoicePDF(items, userData || {}, options, docType, printConfig);
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
            // Hostinger specific and debug settings
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            },
            debug: false, // Disable debug logging for production
            logger: false  // Disable console logging
        });

        const isQuotation = docType === 'Quotation';
        const isProforma = docType === 'Proforma';
        const isDeliveryChallan = docType === 'Delivery Challan';
        const isSaleOrder = docType === 'Sale Order';
        const isJobWork = docType === 'Job Work';
        const invoiceType = isJobWork ? 'Job Work' : (isDeliveryChallan ? 'Delivery Challan' : (isQuotation ? 'Quotation' : (isProforma ? 'Proforma Invoice' : (isPurchase ? 'Purchase Invoice' : (isSaleOrder ? 'Sale Order' : 'Tax Invoice')))));
        const senderLabel = isPurchase ? 'Vendor' : 'Customer';

        const firstDoc = items[0];
        let details, invoiceNo;
        if (isDeliveryChallan) {
            details = firstDoc.deliveryChallanDetails;
            invoiceNo = items.length === 1 ? details?.challanNumber : 'Multiple';
        } else if (isQuotation) {
            details = firstDoc.quotationDetails;
            invoiceNo = items.length === 1 ? details?.quotationNumber : 'Multiple';
        } else if (isJobWork) {
            details = firstDoc.jobWorkDetails;
            invoiceNo = items.length === 1 ? details?.jobWorkNumber : 'Multiple';
        } else {
            details = firstDoc.invoiceDetails;
            invoiceNo = items.length === 1 ? details?.invoiceNumber : 'Multiple';
        }

        const mailOptions = {
            from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `${invoiceType} ${invoiceNo} from Inout Billing`,
            text: `Dear ${senderLabel},\n\nPlease find attached the ${invoiceType.toLowerCase()} ${invoiceNo}.\n\nThank you!`,
            html: `
                <p>Dear ${senderLabel},</p>
                <p>Please find attached the <strong>${invoiceType.toLowerCase()} ${invoiceNo}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: items.length === 1 ? `${invoiceType.replace(/ /g, '_')}_${invoiceNo}.pdf` : `Merged_${invoiceType.replace(/ /g, '_')}s.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            return { success: true, messageId: info.messageId };
        } catch (mailError) {
            if (mailError.code === 'EAUTH') {
                throw new Error('SMTP Authentication Failed: Please check your SMTP_USER and SMTP_PASS in .env');
            }
            throw mailError;
        }
    } catch (error) {
        console.error('Email Dispatch Error:', error.message);
        throw error;
    }
};

const sendReceiptEmail = async (invoices, email, options = { original: true }) => {
    try {
        if (!email) return;

        const items = Array.isArray(invoices) ? invoices : [invoices];
        if (items.length === 0) return;

        const userData = await User.findById(items[0].userId);
        const pdfBuffer = await generateReceiptVoucherPDF(
            items,
            userData || {},
            "RECEIPT VOUCHER",
            { no: "Receipt No.", date: "Receipt Date", details: "Customer Detail" },
            options
        );

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const receiptNo = items.length === 1 ? items[0].invoiceDetails.invoiceNumber : 'Multiple';

        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Receipt Voucher ${receiptNo} from Inout Billing`,
            text: `Dear Customer,\n\nPlease find attached the receipt voucher ${receiptNo}.\n\nThank you!`,
            html: `
                <p>Dear Customer,</p>
                <p>Please find attached the <strong>receipt voucher ${receiptNo}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: items.length === 1 ? `Receipt_${receiptNo}.pdf` : `Merged_Receipts.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending receipt email:', error);
        throw error;
    }
};

const sendOutwardPaymentEmail = async (payments, email, options = { original: true }) => {
    try {
        if (!email) return;

        const items = Array.isArray(payments) ? payments : [payments];
        if (items.length === 0) return;

        const userData = await User.findById(items[0].userId);
        const pdfBuffer = await generateReceiptVoucherPDF(
            items,
            userData || {},
            "PAYMENT VOUCHER",
            { no: "Payment No.", date: "Payment Date", details: "Vendor Details" },
            options
        );

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const paymentNo = items.length === 1 ? items[0].invoiceDetails.invoiceNumber : 'Multiple';

        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Payment Voucher ${paymentNo} from Inout Billing`,
            text: `Dear Vendor,\n\nPlease find attached the payment voucher ${paymentNo}.\n\nThank you!`,
            html: `
                <p>Dear Vendor,</p>
                <p>Please find attached the <strong>payment voucher ${paymentNo}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: items.length === 1 ? `Payment_${paymentNo}.pdf` : `Merged_Payments.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending outward payment email:', error);
        throw error;
    }
};

const sendProformaEmail = async (proforma, email) => {
    try {
        if (!email) {
            console.log(`No customer email provided, skipping email share.`);
            return;
        }

        const { generateProformaPDF } = require('./pdfHelper');
        const pdfBuffer = await generateProformaPDF(proforma);

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Proforma Invoice ${proforma.proformaDetails.proformaNumber} from Inout Billing`,
            text: `Dear Customer,\n\nPlease find attached the proforma invoice ${proforma.proformaDetails.proformaNumber}.\n\nThank you!`,
            html: `
                <p>Dear Customer,</p>
                <p>Please find attached the <strong>proforma invoice ${proforma.proformaDetails.proformaNumber}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: `Proforma_${proforma.proformaDetails.proformaNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending proforma email:', error);
    }
};

const sendDeliveryChallanEmail = async (challan, email) => {
    try {
        if (!email) {
            console.log(`No customer email provided, skipping email share.`);
            return;
        }

        const { generateDeliveryChallanPDF } = require('./pdfHelper');
        const pdfBuffer = await generateDeliveryChallanPDF(challan);

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Delivery Challan ${challan.deliveryChallanDetails.challanNumber} from Inout Billing`,
            text: `Dear Customer,\n\nPlease find attached the delivery challan ${challan.deliveryChallanDetails.challanNumber}.\n\nThank you!`,
            html: `
                <p>Dear Customer,</p>
                <p>Please find attached the <strong>delivery challan ${challan.deliveryChallanDetails.challanNumber}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: `DeliveryChallan_${challan.deliveryChallanDetails.challanNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending delivery challan email:', error);
    }
};

const sendLedgerEmail = async (ledgerData, email) => {
    try {
        if (!email) return;

        const { generateLedgerPDF } = require('./pdfHelper');
        const pdfBuffer = await generateLedgerPDF(ledgerData);

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const mailOptions = {
            from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
            to: email,
            subject: `Ledger Statement: ${ledgerData.target.companyName} from Inout Billing`,
            text: `Dear User,\n\nPlease find attached the Ledger Statement for ${ledgerData.target.companyName} for the period ${new Date(ledgerData.fromDate).toLocaleDateString()} to ${new Date(ledgerData.toDate).toLocaleDateString()}.\n\nThank you!`,
            html: `
                <p>Dear User,</p>
                <p>Please find attached the <strong>Ledger Statement</strong> for <strong>${ledgerData.target.companyName}</strong>.</p>
                <p><strong>Period:</strong> ${new Date(ledgerData.fromDate).toLocaleDateString()} to ${new Date(ledgerData.toDate).toLocaleDateString()}</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: `Ledger_${ledgerData.target.companyName.replace(/\s+/g, '_')}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending ledger email:', error);
    }
};

module.exports = { sendInvoiceEmail, sendReceiptEmail, sendOutwardPaymentEmail, sendProformaEmail, sendDeliveryChallanEmail, sendLedgerEmail };
