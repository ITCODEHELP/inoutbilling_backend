const PDFDocument = require('pdfkit');

/**
 * Generates a pixel-perfect Job Work PDF matching the specific layout in the reference screenshot.
 * @param {Object|Array} documents - Single or Multiple Job Work documents.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {Object} options - Multi-copy options.
 * @returns {Promise<Buffer>}
 */
const generateJobWorkPDF = (documents, user, options = { original: true }) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const blueColor = "#0056b3";
        const blackColor = "#000000";
        const lightBlueColor = "#E8F3FD";

        const docList = Array.isArray(documents) ? documents : [documents];

        // Determine copies to render
        const copies = [];
        if (options.original) copies.push('original');
        if (options.duplicate) copies.push('duplicate');
        if (options.transport) copies.push('transport');
        if (options.office) copies.push('office');
        if (copies.length === 0) copies.push('original');

        const getCopyLabel = (type) => {
            switch (type) {
                case 'original': return "ORIGINAL FOR RECIPIENT";
                case 'duplicate': return "DUPLICATE COPY";
                case 'transport': return "DUPLICATE FOR TRANSPORTER";
                case 'office': return "TRIPLICATE FOR SUPPLIER";
                default: return "";
            }
        };

        let isFirstPage = true;

        docList.forEach((document) => {
            const details = document.jobWorkDetails;
            const docNumber = details.jobWorkNumber;
            const docDate = details.date;

            copies.forEach((copyType) => {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

                // Layout Constants
                const startX = 40;
                let startY = 40;
                const width = 515;

                // --- 1. TOP HEADER ---
                // Company (Left)
                doc.fillColor(blackColor).fontSize(16).text(user.companyName || "ITCode", startX, startY, { bold: true });
                doc.fontSize(8).text(user.address || "", startX, doc.y + 2);
                doc.text(`${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`, startX, doc.y);

                // User details (Right)
                const rightXStart = startX + 300;
                const rightHeaderWidth = width - 300;
                doc.fillColor(blackColor).fontSize(9).text(`Name : ${user.fullName || ""}`, rightXStart, startY, { align: 'right', width: rightHeaderWidth, bold: true });
                doc.text(`Phone : ${user.phone || ""}`, rightXStart, doc.y + 2, { align: 'right', width: rightHeaderWidth });
                doc.text(`Email : ${user.email || ""}`, rightXStart, doc.y + 2, { align: 'right', width: rightHeaderWidth });

                const headerBottom = 100;

                // --- 2. JOB WORK BAR ---
                doc.rect(startX, headerBottom, width, 18).stroke(blueColor);
                doc.fillColor(blueColor).fontSize(12).text("Job Work", startX, headerBottom + 4, { align: "center", width: width, bold: true });
                doc.fillColor(blackColor).fontSize(7).text(getCopyLabel(copyType), startX, headerBottom + 6, { align: "right", width: width - 5, bold: true });

                // --- 3. CUSTOMER & DOCUMENT DETAILS ---
                const gridTop = headerBottom + 18;
                const gridHeight = 90;
                const colSplit = 250;

                doc.rect(startX, gridTop, width, gridHeight).stroke(blueColor);
                doc.moveTo(startX + colSplit, gridTop).lineTo(startX + colSplit, gridTop + gridHeight).stroke(blueColor);

                // --- Customer Detail (Left) ---
                doc.fillColor(blackColor).fontSize(8).text("Customer Detail", startX, gridTop + 5, { align: 'center', width: colSplit, bold: true });
                doc.moveTo(startX, gridTop + 18).lineTo(startX + colSplit, gridTop + 18).stroke(blueColor);

                let custY = gridTop + 22;
                const drawRow = (label, value) => {
                    doc.fillColor(blackColor).fontSize(8).text(label, startX + 5, custY, { bold: true });
                    doc.text(`: ${value || "-"}`, startX + 65, custY, { width: colSplit - 70 });
                    custY += 12;
                };
                drawRow("Name", document.customerInformation.ms);
                drawRow("Address", document.customerInformation.address);
                drawRow("Phone", document.customerInformation.phone);
                drawRow("GSTIN", document.customerInformation.gstinPan);
                drawRow("Place of Supply", document.customerInformation.placeOfSupply);

                // --- Document Details (Right) ---
                const rightBoxX = startX + colSplit;
                const docDetailsWidth = width - colSplit;

                doc.fontSize(8).text("Job Work No.", rightBoxX + 5, gridTop + 5, { bold: true });
                doc.text(docNumber, rightBoxX + 65, gridTop + 5, { bold: true });

                doc.text("Job Work Date", rightBoxX + 130, gridTop + 5, { bold: true });
                doc.text(new Date(docDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), rightBoxX + 200, gridTop + 5, { align: 'right', width: docDetailsWidth - 205 });

                // --- 4. ITEM TABLE ---
                // BLANK SPACE SECTION
                const blankSpaceHeight = 15;
                const blankSpaceTop = gridTop + gridHeight;
                doc.rect(startX, blankSpaceTop, width, blankSpaceHeight).stroke(blueColor);

                const tableTop = blankSpaceTop + blankSpaceHeight;
                const headerHeight = 25;
                const bodyHeight = 320;

                // Column Widths
                const colSr = 25;
                const colName = 125;
                const colHsn = 45;
                const colQty = 40;
                const colRate = 45;
                const colTaxable = 50;
                const colCGST = 60;
                const colSGST = 60;
                const colTotal = 65;

                const colStartX = [
                    startX,
                    startX + colSr,
                    startX + colSr + colName,
                    startX + colSr + colName + colHsn,
                    startX + colSr + colName + colHsn + colQty,
                    startX + colSr + colName + colHsn + colQty + colRate,
                    startX + colSr + colName + colHsn + colQty + colRate + colTaxable,
                    startX + colSr + colName + colHsn + colQty + colRate + colTaxable + colCGST,
                    startX + colSr + colName + colHsn + colQty + colRate + colTaxable + colCGST + colSGST
                ];

                // Header Background
                doc.rect(startX, tableTop, width, headerHeight).fillAndStroke(lightBlueColor, blueColor);

                // Vertical lines in header
                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, tableTop).lineTo(x, tableTop + headerHeight).stroke(blueColor);
                });

                // Horizontal line for CGST/SGST split
                doc.moveTo(colStartX[6], tableTop + 12).lineTo(colStartX[6] + colCGST, tableTop + 12).stroke(blueColor);
                doc.moveTo(colStartX[7], tableTop + 12).lineTo(colStartX[7] + colSGST, tableTop + 12).stroke(blueColor);

                // Inner vertical lines for split
                doc.moveTo(colStartX[6] + 20, tableTop + 12).lineTo(colStartX[6] + 20, tableTop + headerHeight).stroke(blueColor);
                doc.moveTo(colStartX[7] + 20, tableTop + 12).lineTo(colStartX[7] + 20, tableTop + headerHeight).stroke(blueColor);

                // Header Text
                doc.fillColor(blackColor).fontSize(7).text("Sr.\nNo.", colStartX[0], tableTop + 5, { width: colSr, align: "center", bold: true });
                doc.text("Name of Product / Service", colStartX[1], tableTop + 8, { width: colName, align: "center", bold: true });
                doc.text("HSN / SAC", colStartX[2], tableTop + 8, { width: colHsn, align: "center", bold: true });
                doc.text("Qty", colStartX[3], tableTop + 8, { width: colQty, align: "center", bold: true });
                doc.text("Rate", colStartX[4], tableTop + 8, { width: colRate, align: "center", bold: true });
                doc.text("Taxable Value", colStartX[5], tableTop + 8, { width: colTaxable, align: "center", bold: true });

                doc.text("CGST", colStartX[6], tableTop + 2, { width: colCGST, align: "center", bold: true });
                doc.text("%", colStartX[6], tableTop + 15, { width: 20, align: "center", bold: true });
                doc.text("Amount", colStartX[6] + 20, tableTop + 15, { width: 40, align: "center", bold: true });

                doc.text("SGST", colStartX[7], tableTop + 2, { width: colSGST, align: "center", bold: true });
                doc.text("%", colStartX[7], tableTop + 15, { width: 20, align: "center", bold: true });
                doc.text("Amount", colStartX[7] + 20, tableTop + 15, { width: 40, align: "center", bold: true });

                doc.text("Total", colStartX[8], tableTop + 8, { width: colTotal, align: "center", bold: true });

                // Body Backgrounds
                doc.rect(colStartX[5], tableTop + headerHeight, colTaxable, bodyHeight).fill(lightBlueColor);
                doc.rect(colStartX[8], tableTop + headerHeight, colTotal, bodyHeight).fill(lightBlueColor);

                // Body Box
                doc.rect(startX, tableTop + headerHeight, width, bodyHeight).stroke(blueColor);
                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, tableTop + headerHeight).lineTo(x, tableTop + headerHeight + bodyHeight).stroke(blueColor);
                });

                // Items Rendering
                let itemY = tableTop + headerHeight + 5;
                document.items.forEach((item, index) => {
                    doc.fillColor(blackColor).fontSize(8);
                    doc.text((index + 1).toString(), colStartX[0], itemY, { width: colSr, align: "center" });
                    doc.text(item.productName, colStartX[1] + 5, itemY, { width: colName - 10, bold: true });
                    doc.text(item.hsnSac || "-", colStartX[2], itemY, { width: colHsn, align: "center" });
                    doc.text(item.qty.toFixed(2), colStartX[3], itemY, { width: colQty, align: "center" });
                    doc.text(item.price.toFixed(2), colStartX[4], itemY, { width: colRate, align: "center" });
                    doc.text(item.total.toFixed(2), colStartX[5], itemY, { width: colTaxable, align: "center" });

                    doc.text(item.cgst ? item.cgst.toString() : "0", colStartX[6], itemY, { width: 20, align: "center" });
                    const cgstAmt = (item.total * (item.cgst || 0)) / 100;
                    doc.text(cgstAmt.toFixed(2), colStartX[6] + 20, itemY, { width: 40, align: "center" });

                    doc.text(item.sgst ? item.sgst.toString() : "0", colStartX[7], itemY, { width: 20, align: "center" });
                    const sgstAmt = (item.total * (item.sgst || 0)) / 100;
                    doc.text(sgstAmt.toFixed(2), colStartX[7] + 20, itemY, { width: 40, align: "center" });

                    const lineTotal = item.total + cgstAmt + sgstAmt;
                    doc.text(lineTotal.toFixed(2), colStartX[8], itemY, { width: colTotal, align: "center" });

                    itemY += 15;
                });

                // --- 5. TABLE FOOTER ---
                const footerY = tableTop + headerHeight + bodyHeight;
                doc.rect(startX, footerY, width, 18).fillAndStroke(lightBlueColor, blueColor);

                doc.fillColor(blackColor).fontSize(8).text("Total", startX, footerY + 5, { width: colStartX[3] - startX, align: "center", bold: true });

                const totalQty = document.items.reduce((sum, item) => sum + item.qty, 0);
                doc.text(totalQty.toFixed(2), colStartX[3], footerY + 5, { width: colQty, align: "center", bold: true });

                const totalTaxable = document.items.reduce((sum, item) => sum + item.total, 0);
                doc.text(totalTaxable.toFixed(2), colStartX[5], footerY + 5, { width: colTaxable, align: "center", bold: true });

                const totalCGST = document.items.reduce((sum, item) => sum + (item.total * (item.cgst || 0) / 100), 0);
                doc.text(totalCGST.toFixed(2), colStartX[6] + 20, footerY + 5, { width: 40, align: "center", bold: true });

                const totalSGST = document.items.reduce((sum, item) => sum + (item.total * (item.sgst || 0) / 100), 0);
                doc.text(totalSGST.toFixed(2), colStartX[7] + 20, footerY + 5, { width: 40, align: "center", bold: true });

                doc.text(document.totals.grandTotal.toFixed(2), colStartX[8], footerY + 5, { width: colTotal, align: "center", bold: true });

                // Divider lines in footer
                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, footerY).lineTo(x, footerY + 18).stroke(blueColor);
                });

                // --- 6. LOWER BOXES (FOOTER) ---
                const tableBottomY = footerY + 18;
                const blankSeparatorHeight = 15;
                doc.rect(startX, tableBottomY, width, blankSeparatorHeight).stroke(blueColor);

                const footerBottomY = tableBottomY + blankSeparatorHeight;
                const splitX = colStartX[5];
                const leftBoxW = splitX - startX;
                const rightBoxW = width - leftBoxW;

                // --- LEFT: Words & Terms ---
                // Total in words box
                doc.rect(startX, footerBottomY, leftBoxW, 35).stroke(blueColor);
                doc.fillColor(blackColor).fontSize(8).text("Total in words", startX, footerBottomY + 5, { width: leftBoxW, align: "center", bold: true });
                doc.moveTo(startX, footerBottomY + 16).lineTo(startX + leftBoxW, footerBottomY + 16).stroke(blueColor);
                doc.fontSize(8).text(document.totals.totalInWords || "ZERO RUPEES ONLY", startX, footerBottomY + 22, { width: leftBoxW, align: "center", bold: true });

                // Terms box (Subject to jurisdiction etc)
                const termsHeight = 115;
                doc.rect(startX, footerBottomY + 35, leftBoxW, termsHeight).stroke(blueColor);
                doc.fontSize(8).fillColor(blackColor).text("Subject to our home Jurisdiction.", startX + 5, footerBottomY + 40);
                doc.text("Our Responsibility Ceases as soon as goods leaves our Premises.", startX + 5, doc.y + 2);
                doc.text("Goods once sold will not taken back.", startX + 5, doc.y + 2);
                doc.text("Delivery Ex-Premises.", startX + 5, doc.y + 2);

                // Summary Box
                const summaryHeight = 85; // 6 rows * 15
                doc.rect(splitX, footerBottomY, rightBoxW, summaryHeight).stroke(blueColor);

                const drawSummaryRow = (label, value, y, isLast = false, hasBg = false) => {
                    if (hasBg) {
                        doc.save()
                            .rect(splitX, y, rightBoxW, 15)
                            .fill(lightBlueColor)
                            .restore();
                    }
                    doc.fillColor(blackColor).fontSize(8).text(label, splitX + 5, y + 3, { bold: !isLast });
                    doc.text(value, splitX, y + 3, { align: 'right', width: rightBoxW - 5, bold: true });
                    if (!isLast) {
                        doc.moveTo(splitX, y + 15).lineTo(splitX + rightBoxW, y + 15).stroke(blueColor);
                    }
                };

                const totalTax = (totalCGST + totalSGST);
                drawSummaryRow("Taxable Amount", totalTaxable.toFixed(2), footerBottomY, false, true);
                drawSummaryRow("Add : CGST", totalCGST.toFixed(2), footerBottomY + 15);
                drawSummaryRow("Add : SGST", totalSGST.toFixed(2), footerBottomY + 30);
                drawSummaryRow("Total Tax", totalTax.toFixed(2), footerBottomY + 45, false, true);
                drawSummaryRow("Total Amount After Tax", `₹${document.totals.grandTotal.toFixed(2)}`, footerBottomY + 60, false, true);

                // (E & O.E.) Row
                doc.fillColor(blackColor).fontSize(7).text("(E & O.E.)", splitX, footerBottomY + 78, { align: 'right', width: rightBoxW - 5, bold: true });

                // Signature Section
                const sigBoxY = footerBottomY + 85;
                const sigBoxH = termsHeight + 35 - 85;
                doc.rect(splitX, sigBoxY, rightBoxW, sigBoxH).stroke(blueColor);

                // Certified text row
                doc.fontSize(7).text("Certified that the particulars given above are true and correct.", splitX, sigBoxY + 5, { width: rightBoxW, align: "center", bold: true });

                // Company name
                doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, splitX, sigBoxY + 16, { width: rightBoxW, align: "center", bold: true });

                // Horizontal line below company name
                doc.moveTo(splitX, sigBoxY + 28).lineTo(splitX + rightBoxW, sigBoxY + 28).stroke(blueColor);

                // Bottom signatory label
                doc.moveTo(splitX, sigBoxY + sigBoxH - 15).lineTo(splitX + rightBoxW, sigBoxY + sigBoxH - 15).stroke(blueColor);
                doc.fontSize(7).text("Authorised Signatory", splitX, sigBoxY + sigBoxH - 10, { width: rightBoxW, align: "center", bold: true });
            });
        });

        doc.end();
    });
};

module.exports = { generateJobWorkPDF };
