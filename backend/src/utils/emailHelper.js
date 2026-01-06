const nodemailer = require('nodemailer');
const { generateInvoicePDF } = require('./pdfHelper');

const sendInvoiceEmail = async (invoice, email, isPurchase = false) => {
    try {
        if (!email) {
            console.log(`No ${isPurchase ? 'vendor' : 'customer'} email provided, skipping email share.`);
            return;
        }

        // Generate PDF Buffer
        const pdfBuffer = await generateInvoicePDF(invoice, isPurchase);

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            secure: process.env.EMAIL_PORT == 465,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        const invoiceType = isPurchase ? 'Purchase Invoice' : 'Invoice';
        const senderLabel = isPurchase ? 'Vendor' : 'Customer';

        const mailOptions = {
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
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
    } catch (error) {
        console.error('Error sending email with PDF:', error);
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

module.exports = { sendInvoiceEmail, sendProformaEmail, sendDeliveryChallanEmail };


