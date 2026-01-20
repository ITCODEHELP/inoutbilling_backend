const PDFDocument = require('pdfkit');

/**
 * Generates a precision Purchase Invoice PDF matching the target template screenshot.
 * @param {Object} invoice - Purchase Invoice document.
 * @param {Object} user - Logged-in User (Company) details.
 * @returns {Promise<Buffer>}
 */
const generatePurchaseInvoicePDF = (invoice, user) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 25, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Styling Constants
        const blueColor = "#0056b3";
        const blackColor = "#000000";
        const lightBlueBg = "#E8F3FD";
        const borderColor = "#0056b3";

        const startX = 40;
        const startY = 30;
        const totalWidth = 515;

        // --- 1. HEADER SECTION ---
        // Company Name & Info (Left)
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(16).text(user.companyName || "ITCode", startX, startY);
        doc.font('Helvetica').fontSize(8);
        doc.text(user.address || "", startX, doc.y + 2);
        const cityState = `${user.city || ""} ${user.state || ""}`.trim();
        doc.text(cityState, startX, doc.y + 1);
        if (user.pincode) doc.text(user.pincode, startX, doc.y + 1);

        // User Details (Right)
        let rightY = startY;
        const rightLabelX = 405; // Moved further right
        const rightValueX = 435;

        const drawHeaderRow = (label, value) => {
            doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text(label, rightLabelX, rightY, { width: 25, align: 'right' });
            doc.font('Helvetica').text(`: ${value || "-"}`, rightValueX, rightY);
            rightY += 10;
        };

        drawHeaderRow("Name", user.fullName || user.username);
        drawHeaderRow("Phone", user.phone);
        drawHeaderRow("Email", user.email);

        const headerBottom = 85;

        // --- 2. TITLE BAR ---
        doc.rect(startX, headerBottom, totalWidth, 20).stroke(borderColor);
        doc.fillColor(blueColor).font('Helvetica-Bold').fontSize(10).text("PURCHASE INVOICE", startX, headerBottom + 6, { align: 'center', width: totalWidth });

        doc.fillColor(blackColor).fontSize(7).text("ORIGINAL FOR RECIPIENT", startX, headerBottom + 7, { align: 'right', width: totalWidth - 5 });

        // --- 3. VENDOR & INVOICE DETAILS GRID ---
        const gridTop = headerBottom + 20;
        const gridHeight = 85;
        doc.rect(startX, gridTop, totalWidth, gridHeight).stroke(borderColor);

        // Vertical split: Vendor (left) | Invoice info (right)
        const verticalSplitX = startX + 250;
        doc.moveTo(verticalSplitX, gridTop).lineTo(verticalSplitX, gridTop + gridHeight).stroke(borderColor);

        // Row Headers Area
        doc.rect(startX, gridTop, 250, 15).stroke(borderColor);
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text("Vendor Detail", startX, gridTop + 4, { align: 'center', width: 250 });
        doc.moveTo(startX, gridTop + 15).lineTo(startX + 250, gridTop + 15).stroke(borderColor);

        // Vendor Details
        let vendY = gridTop + 20;
        const drawVendRow = (label, value) => {
            doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text(label, startX + 5, vendY, { width: 40 });
            doc.font('Helvetica').text(`${value || "-"}`, startX + 45, vendY, { width: 200 });
            vendY += (label.includes("\n") ? 20 : 12);
        };

        drawVendRow("M/S", invoice.vendorInformation.ms);
        drawVendRow("Address", invoice.vendorInformation.address);
        drawVendRow("Phone", invoice.vendorInformation.phone);
        drawVendRow("GSTIN", invoice.vendorInformation.gstinPan);
        drawVendRow("Place of\nSupply", invoice.vendorInformation.placeOfSupply);

        // Invoice/Purchase Info (Right side)
        let invY = gridTop + 5;
        const col2LabelX = verticalSplitX + 5;
        const col2ValueX = verticalSplitX + 75;
        const col3LabelX = verticalSplitX + 140;
        const col3ValueX = verticalSplitX + 195;

        const drawInvRow = (label, value, lx, vx) => {
            doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text(label, lx, invY);
            doc.font('Helvetica').text(`${value || "-"}`, vx, invY);
        };

        drawInvRow("Invoice No.", invoice.invoiceDetails.invoiceNumber, col2LabelX, col2ValueX);
        drawInvRow("Invoice Date", invoice.invoiceDetails.date ? new Date(invoice.invoiceDetails.date).toLocaleDateString() : "-", col3LabelX, col3ValueX);

        invY += 15;
        // doc.moveTo(verticalSplitX, invY).lineTo(startX + totalWidth, invY).stroke(borderColor); // Removed per user request
        invY += 5;

        drawInvRow("Reverse Charge", invoice.vendorInformation.reverseCharge ? "Yes" : "No", col2LabelX, col2ValueX);
        drawInvRow("Due Date", invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-", col3LabelX, col3ValueX);

        // --- 4. ITEM TABLE ---
        const blankSectionHeight = 15;
        doc.rect(startX, gridTop + gridHeight, totalWidth, blankSectionHeight).stroke(borderColor);

        const tableTop = gridTop + gridHeight + blankSectionHeight;
        const tableHeaderHeight = 25; // Height for hierarchical header

        doc.rect(startX, tableTop, totalWidth, tableHeaderHeight).fill(lightBlueBg).stroke(borderColor);

        // Column widths
        const colSr = 20;
        const colName = 140;
        const colHsn = 50;
        const colQty = 35;
        const colRate = 45;
        const colTaxable = 45;
        const colGst = 55; // For CGST/SGST container
        const colGstInner = 27.5;
        const colTotal = 65;

        const xPos = {
            sr: startX,
            name: startX + colSr,
            hsn: startX + colSr + colName,
            qty: startX + colSr + colName + colHsn,
            rate: startX + colSr + colName + colHsn + colQty,
            taxable: startX + colSr + colName + colHsn + colQty + colRate,
            cgst: startX + colSr + colName + colHsn + colQty + colRate + colTaxable,
            sgst: startX + colSr + colName + colHsn + colQty + colRate + colTaxable + colGst,
            total: startX + colSr + colName + colHsn + colQty + colRate + colTaxable + (colGst * 2)
        };

        doc.fillColor(blueColor).font('Helvetica-Bold').fontSize(7);

        // Main Headers
        doc.text("Sr. No.", xPos.sr, tableTop + 8, { width: colSr, align: 'center' });
        doc.text("Name of Product / Service", xPos.name, tableTop + 8, { width: colName, align: 'center' });
        doc.text("HSN / SAC", xPos.hsn, tableTop + 8, { width: colHsn, align: 'center' });
        doc.text("Qty", xPos.qty, tableTop + 8, { width: colQty, align: 'center' });
        doc.text("Rate", xPos.rate, tableTop + 8, { width: colRate, align: 'center' });
        doc.text("Taxable Value", xPos.taxable, tableTop + 8, { width: colTaxable, align: 'center' });

        // GST Headers
        doc.text("CGST", xPos.cgst, tableTop + 2, { width: colGst, align: 'center' });
        doc.moveTo(xPos.cgst, tableTop + 12).lineTo(xPos.cgst + colGst, tableTop + 12).stroke(borderColor);
        doc.text("%", xPos.cgst, tableTop + 14, { width: colGstInner, align: 'center' });
        doc.text("Amount", xPos.cgst + colGstInner, tableTop + 14, { width: colGstInner, align: 'center' });
        doc.moveTo(xPos.cgst + colGstInner, tableTop + 12).lineTo(xPos.cgst + colGstInner, tableTop + tableHeaderHeight).stroke(borderColor);

        doc.text("SGST", xPos.sgst, tableTop + 2, { width: colGst, align: 'center' });
        doc.moveTo(xPos.sgst, tableTop + 12).lineTo(xPos.sgst + colGst, tableTop + 12).stroke(borderColor);
        doc.text("%", xPos.sgst, tableTop + 14, { width: colGstInner, align: 'center' });
        doc.text("Amount", xPos.sgst + colGstInner, tableTop + 14, { width: colGstInner, align: 'center' });
        doc.moveTo(xPos.sgst + colGstInner, tableTop + 12).lineTo(xPos.sgst + colGstInner, tableTop + tableHeaderHeight).stroke(borderColor);

        doc.text("Total", xPos.total, tableTop + 8, { width: colTotal, align: 'center' });

        // Vertical lines in header
        [xPos.name, xPos.hsn, xPos.qty, xPos.rate, xPos.taxable, xPos.cgst, xPos.sgst, xPos.total].forEach(x => {
            doc.moveTo(x, tableTop).lineTo(x, tableTop + tableHeaderHeight).stroke(borderColor);
        });

        // Table Body
        let itemY = tableTop + tableHeaderHeight;
        const bodyHeight = 300;

        // Background color for Taxable Value and Total columns (Full Height)
        doc.rect(xPos.taxable, itemY, colTaxable, bodyHeight).fill(lightBlueBg).stroke(borderColor);
        doc.rect(xPos.total, itemY, colTotal + 5, bodyHeight + 10).fill(lightBlueBg).stroke(borderColor);

        doc.rect(startX, itemY, totalWidth, bodyHeight).stroke(borderColor);

        // Vertical lines in body
        [xPos.name, xPos.hsn, xPos.qty, xPos.rate, xPos.taxable, xPos.cgst, xPos.cgst + colGstInner, xPos.sgst, xPos.sgst + colGstInner, xPos.total].forEach(x => {
            doc.moveTo(x, itemY).lineTo(x, itemY + bodyHeight).stroke(borderColor);
        });

        invoice.items.forEach((item, index) => {
            const rowH = 15;

            doc.fillColor(blackColor).font('Helvetica').fontSize(8);
            doc.text((index + 1).toString(), xPos.sr, itemY + 4, { width: colSr, align: 'center' });
            doc.text(item.productName, xPos.name + 3, itemY + 4, { width: colName - 5 });
            doc.text(item.hsnSac || "-", xPos.hsn, itemY + 4, { width: colHsn, align: 'center' });
            doc.text(item.qty.toString(), xPos.qty, itemY + 4, { width: colQty, align: 'center' });
            doc.text(item.price.toFixed(2), xPos.rate, itemY + 4, { width: colRate, align: 'center' });

            const taxable = (item.qty * item.price) - (item.discountValue || 0);
            doc.text(taxable.toFixed(2), xPos.taxable, itemY + 4, { width: colTaxable, align: 'center' });

            doc.text((item.cgst || 0).toString(), xPos.cgst, itemY + 4, { width: colGstInner, align: 'center' });
            doc.text((taxable * (item.cgst || 0) / 100).toFixed(2), xPos.cgst + colGstInner, itemY + 4, { width: colGstInner, align: 'center' });

            doc.text((item.sgst || 0).toString(), xPos.sgst, itemY + 4, { width: colGstInner, align: 'center' });
            doc.text((taxable * (item.sgst || 0) / 100).toFixed(2), xPos.sgst + colGstInner, itemY + 4, { width: colGstInner, align: 'center' });

            doc.text(item.total.toFixed(2), xPos.total, itemY + 4, { width: colTotal, align: 'center' });
            itemY += rowH;
        });

        // Table Total Row
        const footerY = tableTop + tableHeaderHeight + bodyHeight;
        doc.rect(startX, footerY, totalWidth, 15).fill(lightBlueBg).stroke(borderColor);

        // Vertical lines in footer to match table columns
        [xPos.name, xPos.hsn, xPos.qty, xPos.rate, xPos.taxable, xPos.cgst, xPos.cgst + colGstInner, xPos.sgst, xPos.sgst + colGstInner, xPos.total].forEach(x => {
            doc.moveTo(x, footerY).lineTo(x, footerY + 15).stroke(borderColor);
        });

        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(7);
        doc.text("Total", startX, footerY + 4, { align: 'center', width: colSr + colName + colHsn, bold: true });

        const sumQty = invoice.items.reduce((s, i) => s + i.qty, 0);
        doc.fillColor(blackColor).text(sumQty.toString(), xPos.qty, footerY + 4, { align: 'center', width: colQty });
        doc.text(invoice.totals.totalTaxable.toFixed(2), xPos.taxable, footerY + 4, { align: 'center', width: colTaxable });

        const sumCgst = invoice.items.reduce((s, i) => s + ((i.qty * i.price - (i.discountValue || 0)) * (i.cgst || 0) / 100), 0);
        const sumSgst = invoice.items.reduce((s, i) => s + ((i.qty * i.price - (i.discountValue || 0)) * (i.sgst || 0) / 100), 0);
        doc.text(sumCgst.toFixed(2), xPos.cgst + colGstInner, footerY + 4, { align: 'center', width: colGstInner });
        doc.text(sumSgst.toFixed(2), xPos.sgst + colGstInner, footerY + 4, { align: 'center', width: colGstInner });
        doc.text(invoice.totals.grandTotal.toFixed(2), xPos.total, footerY + 4, { align: 'center', width: colTotal });

        // Explicit horizontal line below total row
        doc.moveTo(startX, footerY + 15).lineTo(startX + totalWidth, footerY + 15).stroke(borderColor);

        // --- 4.5 HSN SUMMARY TABLE ---
        const hsnTableTop = footerY + 15 + 5;
        const hsnHeaderHeight = 15;
        const hsnColHsn = 70;
        const hsnColTaxable = 80;
        const hsnColGst = 70; // Header for CGST/SGST/IGST
        const hsnColGstInner = 35; // Rate/Amount
        const hsnColTotalTax = 70;

        const hsnX = {
            hsn: startX,
            taxable: startX + hsnColHsn,
            cgst: startX + hsnColHsn + hsnColTaxable,
            sgst: startX + hsnColHsn + hsnColTaxable + hsnColGst,
            igst: startX + hsnColHsn + hsnColTaxable + (hsnColGst * 2),
            totalTax: startX + hsnColHsn + hsnColTaxable + (hsnColGst * 3)
        };

        // Grouping Logic
        const hsnGroups = {};
        invoice.items.forEach(item => {
            const hsn = item.hsnSac || "N/A";
            if (!hsnGroups[hsn]) {
                hsnGroups[hsn] = {
                    hsnCode: hsn,
                    taxableValue: 0,
                    cgstRate: item.cgst || (item.igst / 2) || 0,
                    sgstRate: item.sgst || (item.igst / 2) || 0,
                    igstRate: item.igst || 0,
                    cgstAmount: 0,
                    sgstAmount: 0,
                    igstAmount: 0,
                    totalTax: 0
                };
            }
            const itemTaxable = (item.qty * item.price) - (item.discountValue || 0);
            const itemCGST = (itemTaxable * (item.cgst || 0)) / 100;
            const itemSGST = (itemTaxable * (item.sgst || 0)) / 100;
            const itemIGST = (itemTaxable * (item.igst || 0)) / 100;

            hsnGroups[hsn].taxableValue += itemTaxable;
            hsnGroups[hsn].cgstAmount += itemCGST;
            hsnGroups[hsn].sgstAmount += itemSGST;
            hsnGroups[hsn].igstAmount += itemIGST;
            hsnGroups[hsn].totalTax += (itemCGST + itemSGST + itemIGST);
        });

        const hsnSummaryRows = Object.values(hsnGroups);
        const hsnTableHeight = (hsnSummaryRows.length + 1) * 15; // +1 for header

        // Draw HSN Header
        doc.rect(startX, hsnTableTop, totalWidth, hsnHeaderHeight).fillAndStroke(lightBlueBg, borderColor);
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(7);
        doc.text("HSN/SAC", hsnX.hsn, hsnTableTop + 4, { width: hsnColHsn, align: 'center' });
        doc.text("Taxable Value", hsnX.taxable, hsnTableTop + 4, { width: hsnColTaxable, align: 'center' });
        doc.text("CGST", hsnX.cgst, hsnTableTop + 4, { width: hsnColGst, align: 'center' });
        doc.text("SGST", hsnX.sgst, hsnTableTop + 4, { width: hsnColGst, align: 'center' });
        doc.text("IGST", hsnX.igst, hsnTableTop + 4, { width: hsnColGst, align: 'center' });
        doc.text("Total Tax", hsnX.totalTax, hsnTableTop + 4, { width: hsnColTotalTax, align: 'center' });

        let hsnCurY = hsnTableTop + hsnHeaderHeight;
        hsnSummaryRows.forEach(row => {
            doc.rect(startX, hsnCurY, totalWidth, 15).stroke(borderColor);
            doc.font('Helvetica').fontSize(7);
            doc.text(row.hsnCode, hsnX.hsn, hsnCurY + 4, { width: hsnColHsn, align: 'center' });
            doc.text(row.taxableValue.toFixed(2), hsnX.taxable, hsnCurY + 4, { width: hsnColTaxable, align: 'center' });
            doc.text(`${row.cgstRate}%: ${row.cgstAmount.toFixed(2)}`, hsnX.cgst, hsnCurY + 4, { width: hsnColGst, align: 'center' });
            doc.text(`${row.sgstRate}%: ${row.sgstAmount.toFixed(2)}`, hsnX.sgst, hsnCurY + 4, { width: hsnColGst, align: 'center' });
            doc.text(`${row.igstRate}%: ${row.igstAmount.toFixed(2)}`, hsnX.igst, hsnCurY + 4, { width: hsnColGst, align: 'center' });
            doc.text(row.totalTax.toFixed(2), hsnX.totalTax, hsnCurY + 4, { width: hsnColTotalTax, align: 'center' });
            hsnCurY += 15;
        });

        // --- 5. REFINED FOOTER SECTION ---
        const footerBlankHeight = 10;
        const footerSummaryY = hsnCurY + footerBlankHeight;
        const totalFooterHeight = 160; // Total height for the footer portion
        const colSplitX = startX + 310; // Splitting point for left and right columns
        const leftColWidth = colSplitX - startX;
        const rightColWidth = totalWidth - leftColWidth;

        // --- LEFT COLUMN: Words & Terms ---
        let leftCurY = footerSummaryY;

        // Total in words Header
        doc.rect(startX, leftCurY, leftColWidth, 15).stroke(borderColor);
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text("Total in words", startX, leftCurY + 4, { align: 'center', width: leftColWidth });
        leftCurY += 15;

        // Total in words Content
        const wordsHeight = 30;
        doc.rect(startX, leftCurY, leftColWidth, wordsHeight).stroke(borderColor);
        doc.fillColor(blackColor).font('Helvetica').fontSize(8).text(invoice.totals.totalInWords || "ZERO RUPEES ONLY", startX + 5, leftCurY + 10, { width: leftColWidth - 10, align: 'center' });
        leftCurY += wordsHeight;

        // Terms & Condition Header
        doc.rect(startX, leftCurY, leftColWidth, 15).stroke(borderColor);
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(8).text("Terms & Condition", startX, leftCurY + 4, { align: 'center', width: leftColWidth });
        leftCurY += 15;


        // --- RIGHT COLUMN: Tax Summary & Signature ---
        let rightCurY = footerSummaryY;
        const rowH = 15;

        const drawSummaryRow = (label, value, isBold = false, isTotal = false, hasBg = false) => {
            const currentFontSize = isTotal ? 9 : 8;
            if (hasBg) {
                doc.rect(colSplitX, rightCurY, rightColWidth, rowH).fill(lightBlueBg).stroke(borderColor);
            } else {
                doc.rect(colSplitX, rightCurY, rightColWidth, rowH).stroke(borderColor);
            }
            if (isTotal) {
                doc.fillColor(blackColor).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(currentFontSize).text(label, colSplitX + 5, rightCurY + 4, { width: xPos.total - colSplitX - 5, align: 'left' });
            } else {
                doc.fillColor(blackColor).font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(currentFontSize).text(label, colSplitX + 5, rightCurY + 4);
            }
            doc.text(value, colSplitX, rightCurY + 4, { align: 'right', width: rightColWidth - 5 });
            rightCurY += rowH;
        };

        drawSummaryRow("Taxable Value", invoice.totals.totalTaxable.toFixed(2), false, false, true);
        drawSummaryRow("Add : CGST", invoice.totals.totalCGST.toFixed(2));
        drawSummaryRow("Add : SGST", invoice.totals.totalSGST.toFixed(2));
        drawSummaryRow("Total Tax", invoice.totals.totalTax.toFixed(2), true, false, true);
        doc.moveTo(colSplitX, rightCurY).lineTo(colSplitX + rightColWidth, rightCurY).stroke(borderColor);
        drawSummaryRow("Total Amount After Tax", `₹${invoice.totals.grandTotal.toFixed(2)}`, true, true, true);

        // (E & O.E.) row
        doc.rect(colSplitX, rightCurY, rightColWidth, 12).stroke(borderColor);
        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(7).text("(E & O.E.)", colSplitX, rightCurY + 3, { align: 'right', width: rightColWidth - 5 });
        rightCurY += 12;

        // SIGNATURE BOX
        const sigBoxHeight = totalFooterHeight - (rightCurY - footerSummaryY);
        doc.rect(colSplitX, rightCurY, rightColWidth, sigBoxHeight).stroke(borderColor);

        doc.fillColor(blackColor).font('Helvetica-Bold').fontSize(6).text("Certified that the particulars given above are true and correct.", colSplitX, rightCurY + 5, { align: 'center', width: rightColWidth });
        doc.fontSize(10).text(`For ${user.companyName || "ITCode"}`, colSplitX, rightCurY + 15, { align: 'center', width: rightColWidth });

        // Horizontal line below "For Company"
        doc.moveTo(colSplitX, rightCurY + 28).lineTo(colSplitX + rightColWidth, rightCurY + 28).stroke(borderColor);

        doc.font('Helvetica').fontSize(8).text("Authorized Signatory", colSplitX, rightCurY + sigBoxHeight - 12, { align: 'center', width: rightColWidth });
        doc.moveTo(colSplitX, rightCurY + sigBoxHeight - 20).lineTo(colSplitX + rightColWidth, rightCurY + sigBoxHeight - 20).stroke(borderColor);

        // --- 7. MAIN OUTER BORDER (Continuous) ---
        doc.rect(startX, headerBottom, totalWidth, (footerSummaryY + totalFooterHeight) - headerBottom).stroke(borderColor);

        // Vertical line between Left and Right footer sections
        doc.moveTo(colSplitX, footerSummaryY).lineTo(colSplitX, footerSummaryY + totalFooterHeight).stroke(borderColor);

        doc.end();
    });
};

module.exports = { generatePurchaseInvoicePDF };
