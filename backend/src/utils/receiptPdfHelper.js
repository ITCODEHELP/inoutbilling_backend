const PDFDocument = require('pdfkit');

/**
 * Generates a Receipt Voucher PDF matching the provided screenshot.
 * @param {Object} data - Payment data mapped to generic structure.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {String} title - Voucher Title (e.g., "RECEIPT VOUCHER" or "PAYMENT VOUCHER").
 * @param {Object} labels - Labels for unique fields (e.g., { no: "Receipt No.", date: "Receipt Date", details: "Customer Detail" }).
 * @returns {Promise<Buffer>}
 */
const generateReceiptVoucherPDF = (data, user, title = "RECEIPT VOUCHER", labels = { no: "Receipt No.", date: "Receipt Date", details: "Customer Detail" }) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const blueColor = "#0056b3";
        const blackColor = "#000000";
        const lightBlueColor = "#E8F3FD";

        // Layout Constants
        const startX = 40;
        let currentY = 40;
        const width = 515;

        // --- 1. TOP HEADER ---
        doc.fillColor(blackColor).fontSize(16).text(user.companyName || "ITCode", startX + 5, currentY, { bold: true });
        doc.fontSize(8).text(user.address || "", startX + 5, doc.y + 2);
        doc.text(`${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`, startX + 5, doc.y);

        doc.fontSize(9).text(`Name : ${user.fullName || ""}`, startX, currentY, { align: "right", width: width });
        doc.text(`Phone : ${user.phone || ""}`, startX, doc.y + 2, { align: "right", width: width });
        doc.text(`Email : ${user.email || ""}`, startX, doc.y + 2, { align: "right", width: width });

        currentY = 100;

        // --- 2. TITLE BAR ---
        doc.rect(startX, currentY, width, 18).stroke(blueColor);
        doc.fillColor(blueColor).fontSize(11).text(title, startX, currentY + 5, { align: "center", width: width, bold: true });

        // --- 3. DETAILS GRID ---
        currentY += 18;
        const gridHeight = 90;
        const colSplit = 350;

        doc.rect(startX, currentY, width, gridHeight).stroke(blueColor);
        doc.moveTo(startX + colSplit, currentY).lineTo(startX + colSplit, currentY + gridHeight).stroke(blueColor);

        doc.fillColor(blackColor).fontSize(9).text(labels.details || "Customer Detail", startX, currentY + 6, { align: "center", width: colSplit, bold: true });
        doc.moveTo(startX, currentY + 20).lineTo(startX + colSplit, currentY + 20).stroke(blueColor);

        let fieldY = currentY + 25;
        const drawField = (label, value) => {
            doc.fillColor(blackColor).fontSize(8).text(label, startX + 5, fieldY, { bold: true });
            doc.text(`: ${value || "-"}`, startX + 65, fieldY, { width: colSplit - 70 });
            fieldY += 12;
        };
        drawField("Name", data.customerInformation.ms);
        drawField("Address", data.customerInformation.address);
        drawField("Phone", data.customerInformation.phone);
        drawField("GSTIN", data.customerInformation.gstinPan);
        drawField("State", data.customerInformation.placeOfSupply);

        const rightStart = startX + colSplit;
        const rightWidth = width - colSplit;
        doc.fillColor(blackColor).fontSize(8).text(labels.no || "Receipt No.", rightStart + 5, currentY + 6, { bold: true });
        doc.text(data.invoiceDetails.invoiceNumber, rightStart + 70, currentY + 6, { align: 'right', width: rightWidth - 75 });
        doc.text(labels.date || "Receipt Date", rightStart + 5, currentY + 26, { bold: true });
        doc.text(new Date(data.invoiceDetails.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), rightStart + 70, currentY + 26, { align: 'right', width: rightWidth - 75 });

        // --- 4. ITEM TABLE ---
        currentY += gridHeight;
        doc.rect(startX, currentY, width, 15).stroke(blueColor);
        currentY += 15;

        const headerHeight = 15;
        doc.rect(startX, currentY, width, headerHeight).fillAndStroke(lightBlueColor, blueColor);
        const colSr = 30;
        const colParticulars = 350;
        const colAmount = 135;
        const cols = [startX, startX + colSr, startX + colSr + colParticulars];
        doc.fillColor(blackColor).fontSize(8);
        doc.text("Sr. No.", cols[0], currentY + 4, { width: colSr, align: "center", bold: true });
        doc.text("Particulars", cols[1], currentY + 4, { width: colParticulars, align: "center", bold: true });
        doc.text("Amount", cols[2], currentY + 4, { width: colAmount, align: "center", bold: true });

        // Table Header Vertical Lines
        doc.moveTo(cols[1], currentY).lineTo(cols[1], currentY + headerHeight).stroke(blueColor);
        doc.moveTo(cols[2], currentY).lineTo(cols[2], currentY + headerHeight).stroke(blueColor);

        currentY += headerHeight;
        const bodyHeight = 350;
        doc.rect(startX, currentY, width, bodyHeight).stroke(blueColor);
        doc.moveTo(cols[1], currentY).lineTo(cols[1], currentY + bodyHeight).stroke(blueColor);
        doc.moveTo(cols[2], currentY).lineTo(cols[2], currentY + bodyHeight).stroke(blueColor);

        let itemY = currentY + 10;
        data.items.forEach((item, idx) => {
            doc.fillColor(blackColor).fontSize(9);
            doc.text((idx + 1).toString(), cols[0], itemY, { width: colSr, align: "center" });
            doc.text(item.productName, cols[1] + 10, itemY, { width: colParticulars - 20, lineGap: 2 });
            doc.text(item.total.toFixed(2), cols[2], itemY, { width: colAmount - 10, align: "right", bold: true });
            itemY += 60;
        });
        currentY += bodyHeight;

        // --- 5. FOOTER SECTION ---
        const leftBoxWidth = 350;
        const rightBoxWidth = width - leftBoxWidth;

        // Row 1: Total in words Label | Total Amount box
        doc.rect(startX, currentY, width, 15).stroke(blueColor);
        doc.moveTo(startX + leftBoxWidth, currentY).lineTo(startX + leftBoxWidth, currentY + 15).stroke(blueColor);
        doc.fillColor(blackColor).fontSize(8).text("Total in words", startX, currentY + 4, { width: leftBoxWidth, align: "center", bold: true });
        doc.rect(startX + leftBoxWidth, currentY, rightBoxWidth, 15).fillAndStroke(lightBlueColor, blueColor);
        doc.fillColor(blackColor).fontSize(8).text("Total Amount", startX + leftBoxWidth + 5, currentY + 4, { bold: true });
        doc.fontSize(10).text(`Rs. ${data.totals.grandTotal.toFixed(2)}`, startX + leftBoxWidth, currentY + 3, { width: rightBoxWidth - 5, align: "right", bold: true });
        currentY += 15;

        // Row 2: Total in words Value | Certified... Strip
        doc.rect(startX, currentY, width, 15).stroke(blueColor);
        doc.moveTo(startX + leftBoxWidth, currentY).lineTo(startX + leftBoxWidth, currentY + 15).stroke(blueColor);
        doc.fillColor(blackColor).fontSize(7).text(data.totals.totalInWords.toUpperCase(), startX, currentY + 4, { width: leftBoxWidth, align: "center", bold: true });
        doc.fillColor(blackColor).fontSize(6).text("Certified that the particulars given above are true and correct.", startX + leftBoxWidth, currentY + 4, { width: rightBoxWidth, align: "center", bold: true });
        currentY += 15;

        // Row 3: Terms Header | (E & O.E.) Strip
        doc.rect(startX, currentY, width, 15).stroke(blueColor);
        doc.moveTo(startX + leftBoxWidth, currentY).lineTo(startX + leftBoxWidth, currentY + 15).stroke(blueColor);
        doc.fillColor(blackColor).fontSize(8).text("Terms and Conditions", startX, currentY + 4, { width: leftBoxWidth, align: "center", bold: true });
        doc.fillColor(blackColor).fontSize(7).text("(E & O.E.)", startX + leftBoxWidth, currentY + 4, { width: rightBoxWidth - 5, align: "right", bold: true });
        currentY += 15;

        // Final Stack: Terms Content (Left) | Signatory Stack (Right)
        const finalStackHeight = 75;
        doc.rect(startX, currentY, width, finalStackHeight).stroke(blueColor);
        doc.moveTo(startX + leftBoxWidth, currentY).lineTo(startX + leftBoxWidth, currentY + finalStackHeight).stroke(blueColor);

        // Left: Terms (Single box)
        doc.fillColor(blackColor).fontSize(7).text(data.termsDetails || "Payment must be made within the specified timeframe.", startX + 5, currentY + 5, { width: leftBoxWidth - 10 });

        // Right side splits
        // 1. For Company
        doc.moveTo(startX + leftBoxWidth, currentY + 20).lineTo(startX + width, currentY + 20).stroke(blueColor);
        doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, startX + leftBoxWidth, currentY + 6, { width: rightBoxWidth, align: "center", bold: true });
        // 2. Blank area for signature (Row 5 - 40px)
        doc.moveTo(startX + leftBoxWidth, currentY + 60).lineTo(startX + width, currentY + 60).stroke(blueColor);
        // 3. Authorized Signatory (Row 6 - 15px)
        doc.fontSize(7).text("Authorized Signatory", startX + leftBoxWidth, currentY + 64, { width: rightBoxWidth, align: "center", bold: true });

        doc.end();
    });
};

module.exports = { generateReceiptVoucherPDF };
