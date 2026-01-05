const PDFDocument = require('pdfkit');

/**
 * Generates an invoice PDF as a Buffer.
 * @param {Object} invoice - The invoice data object.
 * @param {Boolean} isPurchase - Whether it's a purchase invoice.
 * @returns {Promise<Buffer>}
 */
const generateInvoicePDF = (invoice, isPurchase = false) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const result = Buffer.concat(buffers);
            resolve(result);
        });
        doc.on('error', reject);

        const title = isPurchase ? "PURCHASE INVOICE" : "INVOICE";
        const recipientTitle = isPurchase ? "Vendor:" : "Bill To:";
        const recipientInfo = isPurchase ? invoice.vendorInformation : invoice.customerInformation;

        // Header
        doc.fillColor("#444444")
            .fontSize(20)
            .text(title, 50, 50, { align: "right" })
            .fontSize(10)
            .text(`Invoice Number: ${invoice.invoiceDetails.invoiceNumber}`, 50, 50)
            .text(`Date: ${new Date(invoice.invoiceDetails.date).toLocaleDateString()}`, 50, 65)
            .moveDown();

        doc.lineCap('butt')
            .moveTo(50, 90)
            .lineTo(550, 90)
            .stroke();

        // Recipient Info
        doc.fontSize(12)
            .fillColor("#000000")
            .text(recipientTitle, 50, 110)
            .fontSize(10)
            .text(recipientInfo.ms || recipientInfo.companyName || "", 50, 125)
            .text(recipientInfo.address || "", 50, 140)
            .text(`GSTIN/PAN: ${recipientInfo.gstinPan || recipientInfo.gstin || ""}`, 50, 155)
            .moveDown();

        // Table Header
        const tableTop = 200;
        doc.fontSize(10)
            .fillColor("#444444")
            .text("Product", 50, tableTop)
            .text("Qty", 250, tableTop, { width: 50, align: "right" })
            .text("Price", 320, tableTop, { width: 70, align: "right" })
            .text("Total", 450, tableTop, { width: 100, align: "right" });

        doc.moveTo(50, tableTop + 15)
            .lineTo(550, tableTop + 15)
            .stroke();

        // Table Content
        let y = tableTop + 30;
        invoice.items.forEach(item => {
            doc.fillColor("#000000")
                .text(item.productName, 50, y, { width: 200 })
                .text(item.qty.toString(), 250, y, { width: 50, align: "right" })
                .text(item.price.toFixed(2), 320, y, { width: 70, align: "right" })
                .text(item.total.toFixed(2), 450, y, { width: 100, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y + 10)
            .lineTo(550, y + 10)
            .stroke();

        // Totals
        y += 25;
        doc.fontSize(12)
            .fillColor("#000000")
            .text("Grand Total:", 350, y)
            .text(`${invoice.totals.grandTotal.toFixed(2)}`, 450, y, { width: 100, align: "right" });

        // Footer
        const footerY = 750;
        doc.fontSize(10)
            .fillColor("#444444")
            .text("Thank you for your business!", 50, footerY, { align: "center", width: 500 });

        doc.end();
    });
};

module.exports = { generateInvoicePDF };
