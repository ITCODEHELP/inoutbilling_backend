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

module.exports = { sendInvoiceEmail };
