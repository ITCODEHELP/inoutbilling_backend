const nodemailer = require('nodemailer');
const { generateSaleInvoicePDF } = require('./saleInvoicePdfHelper');
const { generatePurchaseInvoicePDF } = require('./purchaseInvoicePdfHelper');
const User = require('../models/User-Model/User');

const sendInvoiceEmail = async (invoice, email, isPurchase = false) => {
    try {
        if (!email) {
            console.log(`No ${isPurchase ? 'vendor' : 'customer'} email provided, skipping email share.`);
            return;
        }

        const userData = await User.findById(invoice.userId);
        let pdfBuffer;
        if (isPurchase) {
            // Use professional PDF helper for purchase invoices
            pdfBuffer = await generatePurchaseInvoicePDF(invoice, userData || {});
        } else {
            // Use specialized Sale Invoice PDF helper with professional template
            pdfBuffer = await generateSaleInvoicePDF(invoice, userData || {});
        }

        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_PORT == 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        const invoiceType = isPurchase ? 'Purchase Invoice' : 'Tax Invoice';
        const senderLabel = isPurchase ? 'Vendor' : 'Customer';

        const mailOptions = {
            from: process.env.FROM_EMAIL || process.env.SMTP_USER,
            to: email,
            subject: `${invoiceType} ${invoice.invoiceDetails.invoiceNumber} from Inout Billing`,
            text: `Dear ${senderLabel},\n\nPlease find attached the ${invoiceType.toLowerCase()} ${invoice.invoiceDetails.invoiceNumber}.\n\nThank you!`,
            html: `
                <p>Dear ${senderLabel},</p>
                <p>Please find attached the <strong>${invoiceType.toLowerCase()} ${invoice.invoiceDetails.invoiceNumber}</strong>.</p>
                <p>Thank you!</p>
            `,
            attachments: [
                {
                    filename: `${invoiceType.replace(' ', '_')}_${invoice.invoiceDetails.invoiceNumber}.pdf`,
                    content: pdfBuffer,
                    contentType: 'application/pdf'
                }
            ]
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent with PDF attachment: %s', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending email with PDF:', error);
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
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
        console.log('Proforma Email sent: %s', info.messageId);
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
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
        console.log('Delivery Challan Email sent: %s', info.messageId);
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
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
        console.log('Ledger Email sent: %s', info.messageId);
    } catch (error) {
        console.error('Error sending ledger email:', error);
    }
};

module.exports = { sendInvoiceEmail, sendProformaEmail, sendDeliveryChallanEmail, sendLedgerEmail };
