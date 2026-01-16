const PDFDocument = require('pdfkit');

/**
 * Generates a professional Purchase Invoice PDF mirroring the Sale Invoice template.
 * @param {Object} invoice - Purchase Invoice document.
 * @param {Object} user - Logged-in User (Company) details.
 * @returns {Promise<Buffer>}
 */
const generatePurchaseInvoicePDF = (invoice, user) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const blueColor = "#0056b3";
        const blackColor = "#333333";
        const lightGray = "#f2f2f2";

        // Layout Constants
        const startX = 40;
        const startY = 40;
        const width = 515;

        // --- 1. TOP HEADER (COMPANY & USER CONTACT) ---
        // Company (Left)
        doc.fillColor(blackColor).fontSize(16).text(user.companyName || "ITCode", startX + 5, startY, { bold: true });
        doc.fontSize(8).text(user.address || "", startX + 5, doc.y + 2);
        doc.text(`${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`, startX + 5, doc.y);

        // User Contact (Right)
        doc.fontSize(9).text(`Name : ${user.fullName || ""}`, startX, startY, { align: "right", width: width });
        doc.text(`Phone : ${user.phone || ""}`, startX, doc.y + 2, { align: "right", width: width });
        doc.text(`Email : ${user.email || ""}`, startX, doc.y + 2, { align: "right", width: width });

        const headerBottom = 100;

        // --- 2. PURCHASE INVOICE BAR ---
        doc.rect(startX, headerBottom, width, 18).fill(lightGray).stroke(blueColor);
        doc.fillColor(blueColor).fontSize(10).text("PURCHASE INVOICE", startX, headerBottom + 5, { align: "center", width: width, bold: true });
        doc.fillColor(blackColor).fontSize(7).text("OFFICE COPY", startX, headerBottom + 5, { align: "right", width: width - 10 });

        // --- 3. VENDOR & INVOICE DETAILS GRID ---
        const gridTop = headerBottom + 18;
        const gridHeight = 70;
        doc.rect(startX, gridTop, width, gridHeight).stroke(blueColor);

        // Vertical split: Vendor (250) | Invoice Details (remainder)
        doc.moveTo(startX + 250, gridTop).lineTo(startX + 250, gridTop + gridHeight).stroke(blueColor);

        // VENDOR SECTION
        doc.fillColor(blueColor).fontSize(8).text("Vendor Detail", startX + 2, gridTop + 5, { align: "center", width: 248, bold: true });
        doc.moveTo(startX, gridTop + 15).lineTo(startX + 250, gridTop + 15).stroke(blueColor);

        let vendY = gridTop + 20;
        const drawVendRow = (label, value) => {
            doc.fillColor(blackColor).fontSize(8).text(label, startX + 5, vendY, { bold: true });
            doc.text(`: ${value || "-"}`, startX + 55, vendY, { width: 190 });
            vendY += 10;
        };
        drawVendRow("Name", invoice.vendorInformation.ms);
        drawVendRow("Address", invoice.vendorInformation.address);
        drawVendRow("Phone", invoice.vendorInformation.phone);
        drawVendRow("GSTIN", invoice.vendorInformation.gstinPan);
        drawVendRow("Place of Supply", invoice.vendorInformation.placeOfSupply);

        // INVOICE DETAILS SECTION
        let invDetailsY = gridTop + 5;
        const drawInvRow = (label, value, x) => {
            doc.fillColor(blueColor).fontSize(8).text(label, x, invDetailsY, { bold: true });
            doc.fillColor(blackColor).text(value || "-", x + 60, invDetailsY);
        };

        drawInvRow("Invoice No.", invoice.invoiceDetails.invoiceNumber, startX + 260);
        drawInvRow("Invoice Date", new Date(invoice.invoiceDetails.date).toLocaleDateString(), startX + 410);
        invDetailsY += 15;
        doc.moveTo(startX + 250, invDetailsY).lineTo(startX + width, invDetailsY).stroke(blueColor);
        invDetailsY += 5;
        drawInvRow("Due Date", invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-", startX + 260);

        // --- 4. ITEM TABLE ---
        const tableTop = gridTop + gridHeight;
        const tableHeaderHeight = 15;
        doc.rect(startX, tableTop, width, tableHeaderHeight).fill(lightGray).stroke(blueColor);

        // Column widths
        const colSr = 30;
        const colName = 180;
        const colHsn = 70;
        const colQty = 50;
        const colRate = 80;
        const colTotal = 105;

        const colStartX = [
            startX,
            startX + colSr,
            startX + colSr + colName,
            startX + colSr + colName + colHsn,
            startX + colSr + colName + colHsn + colQty,
            startX + colSr + colName + colHsn + colQty + colRate
        ];

        doc.fillColor(blueColor).fontSize(7);
        doc.text("Sr. No.", colStartX[0], tableTop + 4, { width: colSr, align: "center", bold: true });
        doc.text("Name of Product / Service", colStartX[1], tableTop + 4, { width: colName, align: "center", bold: true });
        doc.text("HSN / SAC", colStartX[2], tableTop + 4, { width: colHsn, align: "center", bold: true });
        doc.text("QTY", colStartX[3], tableTop + 4, { width: colQty, align: "center", bold: true });
        doc.text("RATE", colStartX[4], tableTop + 4, { width: colRate, align: "center", bold: true });
        doc.text("TOTAL", colStartX[5], tableTop + 4, { width: colTotal, align: "center", bold: true });

        // Table Body
        let itemY = tableTop + tableHeaderHeight;
        const tableBodyHeight = 350;
        doc.rect(startX, itemY, width, tableBodyHeight).stroke(blueColor);

        // Vertical lines for columns
        colStartX.slice(1).forEach(x => {
            doc.moveTo(x, itemY).lineTo(x, itemY + tableBodyHeight).stroke(blueColor);
        });

        invoice.items.forEach((item, index) => {
            doc.fillColor(blackColor).fontSize(8);
            doc.text((index + 1).toString(), colStartX[0], itemY + 5, { width: colSr, align: "center" });
            doc.text(item.productName, colStartX[1] + 5, itemY + 5, { width: colName - 10 });
            doc.text(item.hsnSac || "-", colStartX[2], itemY + 5, { width: colHsn, align: "center" });
            doc.text(item.qty.toString(), colStartX[3], itemY + 5, { width: colQty, align: "center" });
            doc.text(item.price.toFixed(2), colStartX[4], itemY + 5, { width: colRate, align: "center" });
            doc.text(item.total.toFixed(2), colStartX[5], itemY + 5, { width: colTotal, align: "center" });
            itemY += 15;
        });

        // Table Footer (Total row)
        const tableFooterY = tableTop + tableHeaderHeight + tableBodyHeight;
        doc.rect(startX, tableFooterY, width, 15).fill(lightGray).stroke(blueColor);
        doc.fillColor(blueColor).fontSize(8).text("Total", startX, tableFooterY + 4, { align: "center", width: colSr + colName + colHsn, bold: true });

        const totalQty = invoice.items.reduce((sum, item) => sum + (item.qty || 0), 0);
        doc.fillColor(blackColor).text(totalQty.toString(), colStartX[3], tableFooterY + 4, { width: colQty, align: "center", bold: true });
        doc.text(invoice.totals.grandTotal.toFixed(2), colStartX[5], tableFooterY + 4, { width: colTotal, align: "center", bold: true });

        // --- 5. TOTALS SECTION ---
        const lowerSectionY = tableFooterY + 15;
        const wordsWidth = 350;
        doc.rect(startX, lowerSectionY, width, 30).stroke(blueColor);
        doc.moveTo(startX + wordsWidth, lowerSectionY).lineTo(startX + wordsWidth, lowerSectionY + 30).stroke(blueColor);

        doc.fillColor(blueColor).fontSize(8).text("Total in words", startX + 5, lowerSectionY + 2, { bold: true });
        doc.fillColor(blackColor).fontSize(7).text(invoice.totals.totalInWords || "ZERO RUPEES ONLY", startX + 5, lowerSectionY + 12, { width: wordsWidth - 10 });

        doc.fillColor(blueColor).fontSize(8).text("Total Amount", startX + wordsWidth + 5, lowerSectionY + 2, { bold: true });
        doc.fillColor(blackColor).fontSize(10).text(invoice.totals.grandTotal.toFixed(2), startX + wordsWidth, lowerSectionY + 12, { width: width - wordsWidth, align: "right", bold: true });
        doc.fontSize(6).text("(E & O.E.)", startX + wordsWidth, lowerSectionY + 22, { width: width - wordsWidth - 5, align: "right" });

        // --- 6. TERMS & SIGNATURE ---
        const termsY = lowerSectionY + 30;
        const termsHeight = 80;
        doc.rect(startX, termsY, width, termsHeight).stroke(blueColor);
        doc.moveTo(startX + 250, termsY).lineTo(startX + 250, termsY + termsHeight).stroke(blueColor);

        doc.fillColor(blueColor).fontSize(8).text("Terms and Conditions", startX + 5, termsY + 5, { bold: true });
        doc.fillColor(blackColor).fontSize(6).text(invoice.termsDetails || "Subject to our Home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.", startX + 5, termsY + 15, { width: 240 });

        // Right side: Company Signature
        const sigX = startX + 255;
        doc.fillColor(blackColor).fontSize(6).text("Certified that the particulars given above are true and correct.", sigX, termsY + 5);
        doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, sigX, termsY + 15, { bold: true, align: "center", width: width - 260 });

        doc.fontSize(7).text("Authorized signatory", sigX, termsY + 65, { align: "center", width: width - 260 });

        doc.end();
    });
};

module.exports = { generatePurchaseInvoicePDF };
