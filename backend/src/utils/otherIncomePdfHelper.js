const PDFDocument = require('pdfkit');

/**
 * Generates a Other Income PDF.
 * Template matches the provided screenshot.
 * @param {Object|Array} data - Income data or array of income data.
 * @param {Object} user - Company details.
 * @param {Object} options - Copy selection.
 * @returns {Promise<Buffer>}
 */
const generateOtherIncomePDF = (data, user, options = { original: true }) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const blueColor = "#0056b3";
        const blackColor = "#000000";
        const lightBlueColor = "#E8F3FD";

        // Determine requested copies
        const copies = [];
        if (options.original !== false) copies.push("ORIGINAL FOR RECIPIENT");
        if (options.duplicate) copies.push("DUPLICATE COPY");
        if (options.transport) copies.push("DUPLICATE FOR TRANSPORTER");
        if (options.office) copies.push("TRIPLICATE FOR SUPPLIER");

        // Fallback
        if (copies.length === 0) copies.push("ORIGINAL FOR RECIPIENT");

        const itemsToRender = Array.isArray(data) ? data : [data];
        let isFirstPage = true;

        itemsToRender.forEach((incomeData) => {
            copies.forEach((copyLabel) => {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

                // Layout Constants
                const startX = 40;
                let currentY = 40;
                const width = 515;

                // --- 1. TOP HEADER ---
                doc.fillColor(blackColor).fontSize(16).text(user.companyName || "Company Name", startX + 5, currentY, { bold: true });
                doc.fontSize(8).text(user.address || "", startX + 5, doc.y + 2);
                doc.text(`${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`, startX + 5, doc.y);

                doc.fontSize(9).text(`Name : ${user.fullName || ""}`, startX, currentY, { align: "right", width: width });
                doc.text(`Phone : ${user.phone || ""}`, startX, doc.y + 2, { align: "right", width: width });
                doc.text(`Email : ${user.email || ""}`, startX, doc.y + 2, { align: "right", width: width });

                currentY = 100;

                // --- 2. TITLE BAR ---
                doc.rect(startX, currentY, width, 20).stroke(blueColor);
                doc.fillColor(blueColor).fontSize(12).text("Other Income", startX, currentY + 5, { align: "center", width: width, bold: true });
                doc.fillColor(blackColor).fontSize(8).text(copyLabel, startX, currentY + 6, { align: "right", width: width - 5, bold: true });

                currentY += 20;

                // --- 3. DETAILS GRID ---
                const gridHeight = 20;
                doc.rect(startX, currentY, width, gridHeight).stroke(blueColor);

                // Vertical lines for 3 cols
                doc.moveTo(startX + 170, currentY).lineTo(startX + 170, currentY + gridHeight).stroke(blueColor);


                doc.fillColor(blackColor).fontSize(8);
                doc.text(`Category: ${incomeData.category || "-"}`, startX + 5, currentY + 6, { width: 160, bold: true });
                doc.text(`Income No.: ${incomeData.no || "-"}`, startX + 175, currentY + 6, { width: 160, bold: true, align: 'left' });
                doc.text(`Income Date: ${new Date(incomeData.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`, startX + 345, currentY + 6, { width: 160, bold: true, align: 'right' });

                currentY += gridHeight;
                // Blank section separator
                doc.rect(startX, currentY, width, 15).stroke(blueColor);
                currentY += 15;

                // --- 4. ITEM TABLE ---
                const headerHeight = 25;
                const cols = {
                    sr: 30,
                    name: 300,
                    rate: 85,
                    total: 100
                };
                const x = {
                    sr: startX,
                    name: startX + cols.sr,
                    rate: startX + cols.sr + cols.name,
                    total: startX + cols.sr + cols.name + cols.rate
                };

                doc.rect(startX, currentY, width, headerHeight).fillAndStroke(lightBlueColor, blueColor);
                doc.fillColor(blackColor).fontSize(8);

                const centerText = (txt, xPos, w, yOff = 8) => doc.text(txt, xPos, currentY + yOff, { width: w, align: "center", bold: true });

                centerText("Sr. No.", x.sr, cols.sr);
                centerText("Name of Product / Service", x.name, cols.name);
                centerText("Rate", x.rate, cols.rate);
                centerText("Total", x.total, cols.total);

                // Verticals
                [x.name, x.rate, x.total].forEach(vx => doc.moveTo(vx, currentY).lineTo(vx, currentY + headerHeight).stroke(blueColor));

                currentY += headerHeight;

                // Table Body
                const bodyHeight = 400;
                doc.rect(startX, currentY, width, bodyHeight).stroke(blueColor);
                [x.name, x.rate, x.total].forEach(vx => doc.moveTo(vx, currentY).lineTo(vx, currentY + bodyHeight).stroke(blueColor));

                let itemY = currentY + 10;
                (incomeData.items || []).forEach((item, idx) => {
                    doc.fillColor(blackColor).fontSize(8);
                    doc.text((idx + 1).toString(), x.sr, itemY, { width: cols.sr, align: "center" });
                    doc.text(item.name || "-", x.name + 5, itemY, { width: cols.name - 10 });
                    doc.text((item.rate || 0).toFixed(2), x.rate, itemY, { width: cols.rate - 5, align: "right" });
                    doc.text((item.total || 0).toFixed(2), x.total, itemY, { width: cols.total - 5, align: "right", bold: true });
                    itemY += 20;
                });

                currentY += bodyHeight;

                // --- 5. SUMMARY ROW ---
                const summaryHeight = 20;
                doc.rect(startX, currentY, width, summaryHeight).fillAndStroke(lightBlueColor, blueColor);
                doc.fillColor(blackColor).fontSize(9).text("Total", x.sr, currentY + 6, { width: cols.sr + cols.name + cols.rate - 5, align: "right", bold: true });
                doc.text((incomeData.grandTotal || 0).toFixed(2), x.total, currentY + 6, { width: cols.total - 5, align: "right", bold: true });

                // Summary Vertical
                doc.moveTo(x.total, currentY).lineTo(x.total, currentY + summaryHeight).stroke(blueColor);

                currentY += summaryHeight;
                // Blank gap
                doc.rect(startX, currentY, width, 10).stroke(blueColor);
                currentY += 10;

                // --- 6. FOOTER ---
                const footerHeight = 120;
                const leftSideWidth = 315;
                const rightSideWidth = width - leftSideWidth;
                const rightSideStart = startX + leftSideWidth;

                // Total in words box vs Total Amount box (Row 1)
                doc.rect(startX, currentY, leftSideWidth, 20).stroke(blueColor);
                doc.rect(rightSideStart, currentY, rightSideWidth, 20).stroke(blueColor);

                doc.fillColor(blackColor).fontSize(8).text("Total in words", startX, currentY + 6, { width: leftSideWidth, align: "center", bold: true });
                doc.text("Total Amount", rightSideStart + 5, currentY + 6, { bold: true });
                doc.text(`\u20B9 ${incomeData.grandTotal.toFixed(2)}`, rightSideStart, currentY + 6, { width: rightSideWidth - 5, align: "right", bold: true });

                currentY += 20;

                // Row 2: Value / E&OE (Height: 20px) - Aligned
                doc.rect(startX, currentY, leftSideWidth, 20).stroke(blueColor);
                doc.rect(rightSideStart, currentY, rightSideWidth, 20).stroke(blueColor);

                const words = (incomeData.totalInWords || "").toUpperCase();
                doc.text(words, startX + 5, currentY + 6, { width: leftSideWidth - 10, align: "center" });
                doc.fontSize(7).text("(E & O.E.)", rightSideStart, currentY + 6, { width: rightSideWidth - 5, align: "right" });

                currentY += 20;

                // Bottom Container (Height: 100px) - Aligned
                const bottomContainerHeight = 100;

                // Left Bottom Area
                doc.rect(startX, currentY, leftSideWidth, bottomContainerHeight).stroke(blueColor);
                let lbY = currentY + 5;
                if (incomeData.bankDetails) {
                    doc.fontSize(7).text("Bank Details:", startX + 5, lbY, { bold: true });
                    lbY += 10;
                    doc.text(`Bank: ${incomeData.bankDetails.bankName}`, startX + 10, lbY);
                    lbY += 9;
                    doc.text(`A/c No: ${incomeData.bankDetails.accountNumber}`, startX + 10, lbY);
                    lbY += 9;
                    doc.text(`IFSC: ${incomeData.bankDetails.ifsc}`, startX + 10, lbY);
                    lbY += 10;
                }

                if (incomeData.customFields && incomeData.customFields.length > 0) {
                    incomeData.customFields.forEach(cf => {
                        doc.fontSize(7).text(`${cf.name}: ${cf.value}`, startX + 5, lbY, { width: leftSideWidth - 10 });
                        lbY += 10;
                    });
                }
                if (incomeData.remarks) {
                    doc.fontSize(7).text(`Remarks: ${incomeData.remarks}`, startX + 5, currentY + bottomContainerHeight - 12, { width: leftSideWidth - 10 });
                }

                // Right Bottom Area
                let rY = currentY;

                // Gap (10px)
                doc.rect(rightSideStart, rY, rightSideWidth, 10).stroke(blueColor);
                rY += 10;

                // Certification (30px)
                const certBoxHeight = 30;
                doc.rect(rightSideStart, rY, rightSideWidth, certBoxHeight).stroke(blueColor);
                doc.fontSize(7).text("Certified that the particulars given above are true and correct.", rightSideStart, rY + 4, { width: rightSideWidth, align: "center" });
                doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, rightSideStart, rY + 14, { width: rightSideWidth, align: "center", bold: true });
                rY += certBoxHeight;

                // Signature Area (40px)
                doc.rect(rightSideStart, rY, rightSideWidth, 40).stroke(blueColor);
                rY += 40;

                // Authorised Signatory Tag (20px)
                doc.rect(rightSideStart, rY, rightSideWidth, 20).stroke(blueColor);
                doc.fontSize(8).text("Authorised Signatory", rightSideStart, rY + 6, { width: rightSideWidth, align: "center", bold: true });
            });
        });

        doc.end();
    });
};

module.exports = { generateOtherIncomePDF };
