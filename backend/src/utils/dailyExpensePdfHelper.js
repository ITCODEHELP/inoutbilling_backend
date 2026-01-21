const PDFDocument = require('pdfkit');

/**
 * Generates a Daily Expense PDF.
 * Header/Body: Matches Screenshot.
 * Footer: Split Layout with background colors for Taxable/Total rows.
 * @param {Object} data - Expense data.
 * @param {Object} user - Company details.
 * @returns {Promise<Buffer>}
 */
const generateDailyExpensePDF = (data, user, options = { original: true }) => {
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

        // Fallback: If nothing selected, default to original
        if (copies.length === 0) copies.push("ORIGINAL FOR RECIPIENT");

        const itemsToRender = Array.isArray(data) ? data : [data];
        let isFirstPage = true;

        itemsToRender.forEach((expenseData) => {
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
                doc.fillColor(blueColor).fontSize(12).text("Daily Expense", startX, currentY + 5, { align: "center", width: width, bold: true });
                doc.fillColor(blackColor).fontSize(8).text(copyLabel, startX, currentY + 6, { align: "right", width: width - 5, bold: true });

                currentY += 20;

                // --- 3. DETAILS SECTION ---
                const sectionHeight = 90;
                const colSplit = 300;

                doc.rect(startX, currentY, width, sectionHeight).stroke(blueColor);
                doc.moveTo(startX + colSplit, currentY).lineTo(startX + colSplit, currentY + sectionHeight).stroke(blueColor);

                // -- LEFT: Customer Detail --
                doc.fillColor(blueColor).fontSize(9).text("Customer Detail", startX, currentY + 4, { align: "center", width: colSplit, bold: true });
                doc.moveTo(startX, currentY + 15).lineTo(startX + colSplit, currentY + 15).stroke(blueColor);

                // Fields
                let leftY = currentY + 20;
                const drawLeftField = (label, value) => {
                    doc.fillColor(blackColor).fontSize(8).text(label, startX + 5, leftY, { width: 70, bold: true });
                    doc.text(value || "-", startX + 80, leftY, { width: colSplit - 85 });
                    leftY += 12;
                };
                drawLeftField("M/S", expenseData.vendorDetails.name);
                drawLeftField("Address", expenseData.vendorDetails.address);
                drawLeftField("Phone", expenseData.vendorDetails.phone);
                drawLeftField("GSTIN", expenseData.vendorDetails.gstin);
                drawLeftField("Place of Supply", expenseData.vendorDetails.state);

                // -- RIGHT: Expense Details --
                let rightY = currentY + 20;
                const drawRightField = (label, value) => {
                    doc.fillColor(blackColor).fontSize(8).text(label, startX + colSplit + 10, rightY, { width: 80, bold: true });
                    doc.text(value || "-", startX + colSplit + 90, rightY, { width: width - colSplit - 100 });
                    rightY += 15;
                };
                drawRightField("Expense No.", expenseData.expenseDetails.no);
                drawRightField("Category", expenseData.vendorDetails.category);
                drawRightField("Expense Date", new Date(expenseData.expenseDetails.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }));

                currentY += sectionHeight;
                // Blank section above item table
                doc.rect(startX, currentY, width, 15).stroke(blueColor);
                currentY += 15;

                // --- 4. ITEM TABLE ---
                const headerHeight = 25;
                // Columns: Sr(25), Name(140), Qty(35), Rate(45), Disc(30), Taxable(50), IGST%(30), IGST Amt(40), Cess(30), Total(90)
                const cols = {
                    sr: 25,
                    name: 140,
                    qty: 35,
                    rate: 45,
                    disc: 30,
                    taxable: 50,
                    igstPer: 30,
                    igstAmt: 40,
                    cess: 30,
                    total: 90
                };

                const x = {
                    sr: startX,
                    name: startX + cols.sr,
                    qty: startX + cols.sr + cols.name,
                    rate: startX + cols.sr + cols.name + cols.qty,
                    disc: startX + cols.sr + cols.name + cols.qty + cols.rate,
                    taxable: startX + cols.sr + cols.name + cols.qty + cols.rate + cols.disc,
                    igstPer: startX + cols.sr + cols.name + cols.qty + cols.rate + cols.disc + cols.taxable,
                    igstAmt: startX + cols.sr + cols.name + cols.qty + cols.rate + cols.disc + cols.taxable + cols.igstPer,
                    cess: startX + cols.sr + cols.name + cols.qty + cols.rate + cols.disc + cols.taxable + cols.igstPer + cols.igstAmt,
                    total: startX + cols.sr + cols.name + cols.qty + cols.rate + cols.disc + cols.taxable + cols.igstPer + cols.igstAmt + cols.cess
                };

                // Draw Header
                doc.rect(startX, currentY, width, headerHeight).fillAndStroke(lightBlueColor, blueColor);
                doc.fillColor(blackColor).fontSize(8);
                const centerText = (txt, xPos, w, yOff = 8) => doc.text(txt, xPos, currentY + yOff, { width: w, align: "center", bold: true });

                centerText("Sr.", x.sr, cols.sr);
                centerText("Name of Product / Service", x.name, cols.name, 4);
                centerText("Qty", x.qty, cols.qty);
                centerText("Rate", x.rate, cols.rate);
                centerText("Disc.", x.disc, cols.disc, 2);
                centerText("(%)", x.disc, cols.disc, 10);
                centerText("Taxable", x.taxable, cols.taxable, 2);
                centerText("Value", x.taxable, cols.taxable, 10);

                // IGST Split
                doc.text("IGST", x.igstPer, currentY + 2, { width: cols.igstPer + cols.igstAmt, align: "center", bold: true });
                doc.moveTo(x.igstPer, currentY + 12).lineTo(x.cess, currentY + 12).stroke(blueColor);
                doc.text("%", x.igstPer, currentY + 13, { width: cols.igstPer, align: "center", bold: true });
                doc.text("Amount", x.igstAmt, currentY + 13, { width: cols.igstAmt, align: "center", bold: true });
                doc.moveTo(x.igstAmt, currentY + 12).lineTo(x.igstAmt, currentY + headerHeight).stroke(blueColor);

                centerText("Cess", x.cess, cols.cess);
                centerText("Total", x.total, cols.total);

                // Header Verticals
                const verticals = [x.name, x.qty, x.rate, x.disc, x.taxable, x.igstPer, x.cess, x.total];
                verticals.forEach(vx => doc.moveTo(vx, currentY).lineTo(vx, currentY + headerHeight).stroke(blueColor));

                currentY += headerHeight;

                // Table Body
                const bodyHeight = 350;
                // Background for Taxable Column
                doc.rect(x.taxable, currentY, cols.taxable, bodyHeight).fill(lightBlueColor);
                // Background for Total Column
                doc.rect(x.total, currentY, cols.total, bodyHeight).fill(lightBlueColor);

                doc.rect(startX, currentY, width, bodyHeight).stroke(blueColor);
                verticals.forEach(vx => doc.moveTo(vx, currentY).lineTo(vx, currentY + bodyHeight).stroke(blueColor));
                doc.moveTo(x.igstAmt, currentY).lineTo(x.igstAmt, currentY + bodyHeight).stroke(blueColor);

                let itemY = currentY + 10;
                expenseData.items.forEach((item, idx) => {
                    doc.fillColor(blackColor).fontSize(8);
                    centerText((idx + 1).toString(), x.sr, cols.sr, itemY - currentY);
                    doc.text(item.name, x.name + 2, itemY, { width: cols.name - 4 });
                    doc.text((item.qty || 0).toFixed(2), x.qty, itemY, { width: cols.qty - 2, align: "right" });
                    doc.text((item.rate || 0).toFixed(2), x.rate, itemY, { width: cols.rate - 2, align: "right" });
                    doc.text((item.discount || 0).toFixed(2), x.disc, itemY, { width: cols.disc - 2, align: "right" });
                    doc.text((item.taxable || 0).toFixed(2), x.taxable, itemY, { width: cols.taxable - 2, align: "right" });
                    doc.text((item.igstPer || 0).toFixed(2), x.igstPer, itemY, { width: cols.igstPer - 2, align: "right" });
                    doc.text((item.igstAmt || 0).toFixed(2), x.igstAmt, itemY, { width: cols.igstAmt - 2, align: "right" });
                    doc.text((item.cess || 0).toFixed(2), x.cess, itemY, { width: cols.cess - 2, align: "right" });
                    doc.text((item.total || 0).toFixed(2), x.total, itemY, { width: cols.total - 2, align: "right", bold: true });

                    itemY += 20;
                });

                currentY += bodyHeight;

                // --- 5. SUMMARY ROW ---
                const summaryHeight = 20;
                doc.rect(startX, currentY, width, summaryHeight).fillAndStroke(lightBlueColor, blueColor);

                doc.fillColor(blackColor).fontSize(8).text("Total", x.sr, currentY + 6, { width: cols.sr + cols.name, align: "right", bold: true });

                const drawSummary = (val, xPos, w) => doc.text((val || 0).toFixed(2), xPos, currentY + 6, { width: w - 2, align: "right", bold: true });

                drawSummary(expenseData.totals.totalQty, x.qty, cols.qty);
                drawSummary(expenseData.totals.totalDisc, x.disc, cols.disc);
                drawSummary(expenseData.totals.totalTaxable, x.taxable, cols.taxable);
                drawSummary(expenseData.totals.totalIgst, x.igstAmt, cols.igstAmt);
                drawSummary(expenseData.totals.totalCess, x.cess, cols.cess);
                drawSummary(expenseData.totals.grandTotal, x.total, cols.total);

                // Summary Verticals
                verticals.forEach(vx => doc.moveTo(vx, currentY).lineTo(vx, currentY + summaryHeight).stroke(blueColor));
                doc.moveTo(x.igstAmt, currentY).lineTo(x.igstAmt, currentY + summaryHeight).stroke(blueColor);

                currentY += summaryHeight;
                // Blank section above footer
                doc.rect(startX, currentY, width, 15).stroke(blueColor);
                currentY += 15;

                // --- 6. FOOTER SECTION (SPLIT + BACKGROUNDS) ---
                const leftWidth = 320;
                const rightWidth = width - leftWidth;
                const rightStart = startX + leftWidth;

                // Height calculation for Right Content
                const footerHeight = 175;

                // Outer Border
                doc.rect(startX, currentY, width, footerHeight).stroke(blueColor);
                // Vertical Split
                doc.moveTo(rightStart, currentY).lineTo(rightStart, currentY + footerHeight).stroke(blueColor);

                // --- LEFT: Words ---
                doc.rect(startX, currentY, leftWidth, 18).stroke(blueColor);
                doc.moveTo(startX, currentY + 18).lineTo(startX + leftWidth, currentY + 18).stroke(blueColor);

                doc.fillColor(blackColor).fontSize(8).text("Total in words", startX + 5, currentY + 5, { width: leftWidth, align: "center", bold: true });

                // Words Value
                doc.fontSize(8).text(expenseData.totals.totalInWords.toUpperCase(), startX + 5, currentY + 25, { width: leftWidth - 10, align: "center" });
                // Line below words
                doc.moveTo(startX, currentY + 40).lineTo(startX + leftWidth, currentY + 40).stroke(blueColor);

                // Render Custom Fields
                if (expenseData.customFields && expenseData.customFields.length > 0) {
                    let cfY = currentY + 45;
                    expenseData.customFields.forEach(cf => {
                        doc.fontSize(8).fillColor(blackColor).text(`${cf.name}: ${cf.value}`, startX + 5, cfY, { width: leftWidth - 10 });
                        cfY += 12;
                    });
                }

                // --- RIGHT: Tax + Signatory ---
                let taxY = currentY;
                const taxRowH = 15;

                const drawTaxRow = (label, value, bold = false, fill = false) => {
                    if (fill) {
                        doc.rect(rightStart, taxY, rightWidth, taxRowH).fillAndStroke(lightBlueColor, blueColor);
                    } else {
                        doc.moveTo(rightStart, taxY + taxRowH).lineTo(startX + width, taxY + taxRowH).stroke(blueColor);
                    }
                    doc.fillColor(blackColor).fontSize(8).text(label, rightStart + 5, taxY + 4, { bold });
                    doc.text(value, rightStart + 5, taxY + 4, { width: rightWidth - 10, align: "right", bold });
                    taxY += taxRowH;
                };

                // Taxable Amount (Filled)
                drawTaxRow("Taxable Amount", (expenseData.totals.totalTaxable || 0).toFixed(2), false, true);
                drawTaxRow("Add : IGST", (expenseData.totals.totalIgst || 0).toFixed(2));
                drawTaxRow("Add : Cess", (expenseData.totals.totalCess || 0).toFixed(2));
                drawTaxRow("Total Tax", ((expenseData.totals.totalIgst || 0) + (expenseData.totals.totalCess || 0)).toFixed(2));

                // Grand Total (Filled)
                doc.rect(rightStart, taxY, rightWidth, taxRowH).fillAndStroke(lightBlueColor, blueColor);
                doc.fillColor(blackColor).fontSize(8).text("Total Amount After Tax", rightStart + 5, taxY + 4, { bold: true });
                doc.text(`Rs.${expenseData.totals.grandTotal.toFixed(2)}`, rightStart + 5, taxY + 4, { width: rightWidth - 10, align: "right", bold: true });
                taxY += taxRowH;

                // E & O.E.
                doc.fontSize(6).text("(E & O.E.)", rightStart + 5, taxY + 2, { width: rightWidth - 10, align: "right" });

                // Separator for Signatory
                const sigStartY = taxY + 15;
                doc.moveTo(rightStart, sigStartY).lineTo(startX + width, sigStartY).stroke(blueColor);

                // Signatory Details
                let sigY = sigStartY + 5;
                doc.fillColor(blackColor).fontSize(7).text("Certified that the particulars given above are true and correct.", rightStart + 2, sigY, { width: rightWidth - 4, align: "center" });
                sigY += 12;
                doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, rightStart + 5, sigY, { width: rightWidth - 10, align: "center", bold: true });

                // Horizontal Line below "For Company"
                sigY += 15; // Move down below text
                doc.moveTo(rightStart, sigY).lineTo(startX + width, sigY).stroke(blueColor);

                // Authorized Signatory at bottom
                doc.moveTo(rightStart, currentY + footerHeight - 15).lineTo(startX + width, currentY + footerHeight - 15).stroke(blueColor);
                doc.fontSize(7).text("Authorised Signatory", rightStart + 5, currentY + footerHeight - 10, { width: rightWidth - 10, align: "center", bold: true });

                // Cancelled Watermark
                if (expenseData.status === 'CANCELLED') {
                    doc.save();
                    doc.fillColor('red').opacity(0.15).fontSize(100);
                    doc.rotate(-30, { origin: [startX + width / 2, currentY - 200] });
                    doc.text('CANCELLED', startX, currentY - 200, { align: 'center', width: width });
                    doc.restore();
                }
            });
        });

        doc.end();
    });
};

module.exports = { generateDailyExpensePDF };
