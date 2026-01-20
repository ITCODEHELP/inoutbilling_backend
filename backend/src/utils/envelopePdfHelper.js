const PDFDocument = require('pdfkit');

/**
 * Generates an Envelope PDF for a Purchase Invoice (Vendor/Recipient).
 * @param {Object} invoice - Purchase Invoice doc.
 * @param {Object} user - Company/Sender details.
 * @param {String} size - Envelope size: 'Small', 'Medium', 'Large'.
 * @returns {Promise<Buffer>}
 */
const generateEnvelopePDF = (invoice, user, size = 'Medium') => {
    return new Promise((resolve, reject) => {
        // Define sizes in points (1 inch = 72 points)
        const sizes = {
            'Small': [560, 500],
            'Medium': [820, 700],
            'Large': [864, 900]
        };

        const pageSize = sizes[size] || sizes['Medium'];
        const doc = new PDFDocument({ margin: 20, size: pageSize });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const width = pageSize[0];
        const height = pageSize[1];

        // --- 1. RECIPIENT (Top Left) ---
        const toX = 50;
        let toY = 50;

        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(12);
        doc.text("TO:", toX, toY);
        toY += 15;

        doc.text((invoice.vendorInformation.ms || "").toUpperCase(), toX, toY);
        toY += 15;

        doc.font('Helvetica').fontSize(10);
        const recipientAddr = (invoice.vendorInformation.address || invoice.vendorInformation.placeOfSupply || "").toUpperCase();
        doc.text(recipientAddr, toX, toY, { width: width * 0.45 });

        // --- 2. SENDER (Bottom Right Area) ---
        const fromX = width * 0.55;
        let fromY = 300; // Fixed vertical height for standard appearance

        doc.font('Helvetica-Bold').fontSize(11);
        doc.text("FROM:", fromX, fromY);
        fromY += 15;

        doc.text((user.companyName || "ITCODE").toUpperCase(), fromX, fromY, { underline: true });
        fromY += 15;

        doc.font('Helvetica').fontSize(9);
        const addrParts = [
            user.address,
            user.city,
            user.state,
            user.pincode
        ].filter(Boolean).map(s => s.toString().toUpperCase());

        const senderAddressLine = addrParts.join(', ');
        doc.text(senderAddressLine, fromX, fromY, { width: width - fromX - 30 });
        fromY += doc.heightOfString(senderAddressLine, { width: width - fromX - 30 }) + 5;

        if (user.phone) {
            doc.text(`(M) ${user.phone}`.toUpperCase(), fromX, fromY);
            fromY += 12;
        }

        if (user.email) {
            doc.text(user.email.toUpperCase(), fromX, fromY);
        }

        doc.end();
    });
};

module.exports = { generateEnvelopePDF };
