const PDFDocument = require('pdfkit');

/**
 * Generates a professional Sale Invoice or Quotation PDF matching the provided blue grid template.
 * @param {Object|Array} documents - Single or Multiple Sale Invoice or Quotation documents.
 * @param {Object} user - Logged-in User (Company) details.
 * @param {Object} options - Multi-copy options.
 * @param {String} docType - 'Sale Invoice' or 'Quotation'.
 * @returns {Promise<Buffer>}
 */
const generateSaleInvoicePDF = (documents, user, options = { original: true }, docType = 'Sale Invoice') => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const blueColor = "#0056b3";
        const blackColor = "#000000";
        const lightBlueColor = "#E8F3FD";

        const isQuotation = docType === 'Quotation';
        const isDeliveryChallan = docType === 'Delivery Challan';
        const isPurchaseOrder = options.isPurchaseOrder === true;
        const isSaleOrder = docType === 'Sale Order';
        const isJobWork = docType === 'Job Work';
        const isPackingList = docType === 'Packing List';

        const titleLabel = options.titleLabel || (isPurchaseOrder ? "PURCHASE ORDER" : (isJobWork ? "JOB WORK" : (isDeliveryChallan ? "DELIVERY CHALLAN" : (isQuotation ? "QUOTATION" : (isSaleOrder ? "SALE ORDER" : (isPackingList ? "PACKING LIST" : "TAX INVOICE"))))));
        const numLabel = options.numLabel || (isPurchaseOrder ? "PO No." : (isJobWork ? "Job Work No." : (isDeliveryChallan ? "Challan No." : (isQuotation ? "Quotation No." : (isSaleOrder ? "Sale Order No." : (isPackingList ? "Packing No." : "Invoice No."))))));
        const dateLabel = options.dateLabel || (isPurchaseOrder ? "PO Date" : (isJobWork ? "Job Work Date" : (isDeliveryChallan ? "Challan Date" : (isQuotation ? "Quotation Date" : (isSaleOrder ? "Sale Order Date" : (isPackingList ? "Date" : "Invoice Date"))))));

        // Determine copies to render
        const copies = [];
        if (options.original) copies.push('original');
        if (options.duplicate) copies.push('duplicate');
        if (options.transport) copies.push('transport');
        if (options.office) copies.push('office');

        // Fallback to original if nothing selected
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

        const docList = Array.isArray(documents) ? documents : [documents];
        let isFirstPage = true;

        docList.forEach((document) => {
            // Map data dynamically
            let details, docNumber;
            if (isDeliveryChallan) {
                details = document.deliveryChallanDetails;
                docNumber = details.challanNumber;
            } else if (isQuotation) {
                details = document.quotationDetails;
                docNumber = details.quotationNumber;
            } else if (isJobWork) {
                details = document.jobWorkDetails;
                docNumber = details.jobWorkNumber;
            } else if (isPackingList) {
                details = document.packingListDetails;
                docNumber = (details.prefix || '') + details.number + (details.postfix || '');
            } else {
                details = document.invoiceDetails;
                docNumber = details.invoiceNumber;
            }
            const docDate = details.date || details.invoiceDate; // Packing list uses invoiceDate

            copies.forEach((copyType) => {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

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

                // --- 2. TAX INVOICE / QUOTATION BAR ---
                doc.rect(startX, headerBottom, width, 18).stroke(blueColor);
                doc.fillColor(blueColor).fontSize(11).text(titleLabel, startX, headerBottom + 5, { align: "center", width: width, bold: true });
                doc.fillColor(blackColor).fontSize(7).text(getCopyLabel(copyType), startX, headerBottom + 5, { align: "right", width: width - 10, bold: true });

                // --- 3. CUSTOMER & DOCUMENT DETAILS GRID ---
                const gridTop = headerBottom + 18;
                const gridHeight = 90;
                const colSplit = 250;

                // Outer Box
                doc.rect(startX, gridTop, width, gridHeight).stroke(blueColor);

                // Vertical split: Customer (Left) | Document Details (Right)
                doc.moveTo(startX + colSplit, gridTop).lineTo(startX + colSplit, gridTop + gridHeight).stroke(blueColor);

                // --- LEFT SIDE: CUSTOMER DETAIL ---
                // Header
                doc.fillColor(blackColor).fontSize(9).text("Customer Detail", startX, gridTop + 6, { align: "center", width: colSplit, bold: true });
                // Horizontal Separator
                doc.moveTo(startX, gridTop + 20).lineTo(startX + colSplit, gridTop + 20).stroke(blueColor);

                // Fields
                let custY = gridTop + 25;
                const drawCustRow = (label, value) => {
                    doc.fillColor(blackColor).fontSize(8).text(label, startX + 5, custY, { bold: true });
                    doc.text(`: ${value || "-"}`, startX + 65, custY, { width: colSplit - 70 });
                    custY += 10;
                };
                drawCustRow("Name", document.customerInformation.ms);
                drawCustRow("Address", document.customerInformation.address);
                drawCustRow("Phone", document.customerInformation.phone);
                drawCustRow("GSTIN", document.customerInformation.gstinPan);
                drawCustRow("Place of Supply", document.customerInformation.placeOfSupply);

                // --- RIGHT SIDE: DOCUMENT DETAILS ---
                const rightStart = startX + colSplit;
                const rightWidth = width - colSplit;
                const rightMid = rightStart + (rightWidth / 2);

                // 1. Top Row: No | Border | Date
                // Vertical Divider between No and Date
                doc.moveTo(rightMid, gridTop).lineTo(rightMid, gridTop + 20).stroke(blueColor);
                // Horizontal Divider below Top Row
                doc.moveTo(rightStart, gridTop + 20).lineTo(startX + width, gridTop + 20).stroke(blueColor);

                // No (Left Half)
                doc.fillColor(blackColor).fontSize(9).text(numLabel, rightStart + 5, gridTop + 6, { bold: true });
                // Increased spacing for Sale Order and Job Work to prevent overlap
                const numXOffset = (isSaleOrder || isJobWork) ? 75 : 60;
                doc.fillColor(blackColor).text(docNumber, rightStart + numXOffset, gridTop + 6, { bold: true });

                // Date (Right Half)
                doc.fillColor(blackColor).text(dateLabel, rightMid + 5, gridTop + 6, { bold: true });
                doc.fillColor(blackColor).text(new Date(docDate).toLocaleDateString(), rightMid + 65, gridTop + 6, { width: (rightWidth / 2) - 70, align: 'right' });

                // 2. Bottom Row: Due Date (Only for Invoice)
                if (!isQuotation && !isSaleOrder && !isJobWork && !options.hideDueDate) {
                    doc.fillColor(blackColor).text("Due Date", rightStart + 5, gridTop + 26, { bold: true });
                    doc.fillColor(blackColor).text(document.dueDate ? new Date(document.dueDate).toLocaleDateString() : "-", rightStart + 60, gridTop + 26);
                }

                // --- 4. ITEM TABLE ---
                // BLANK SPACE SECTION
                const blankSpaceHeight = 15;
                const blankSpaceTop = gridTop + gridHeight;
                doc.rect(startX, blankSpaceTop, width, blankSpaceHeight).stroke(blueColor);

                // TABLE HEADER
                const tableTop = blankSpaceTop + blankSpaceHeight;
                const tableHeaderHeight = 15; // Kept as 15

                // Background Blue
                doc.rect(startX, tableTop, width, tableHeaderHeight).fillAndStroke(lightBlueColor, blueColor);

                // Column widths logic
                let colStartX, headers;

                if (isPackingList) {
                    const colWidths = {
                        sr: 25,
                        name: 115,
                        qty: 45,
                        pkg: 50,
                        kind: 75,
                        net: 65,
                        gross: 65,
                        dim: 74
                    };
                    colStartX = [
                        startX,
                        startX + colWidths.sr,
                        startX + colWidths.sr + colWidths.name,
                        startX + colWidths.sr + colWidths.name + colWidths.qty,
                        startX + colWidths.sr + colWidths.name + colWidths.qty + colWidths.pkg,
                        startX + colWidths.sr + colWidths.name + colWidths.qty + colWidths.pkg + colWidths.kind,
                        startX + colWidths.sr + colWidths.name + colWidths.qty + colWidths.pkg + colWidths.kind + colWidths.net,
                        startX + colWidths.sr + colWidths.name + colWidths.qty + colWidths.pkg + colWidths.kind + colWidths.net + colWidths.gross
                    ];
                    headers = ["Sr. No.", "Product Description", "Quantity", "No. of Package", "Kind Of Package", "Net weight", "Gross weight", "Dimension"];
                } else {
                    const colSr = 30;
                    const colName = 180;
                    const colHsn = 70;
                    const colQty = 50;
                    const colRate = 80;
                    const colTotal = 105;

                    colStartX = [
                        startX,
                        startX + colSr,
                        startX + colSr + colName,
                        startX + colSr + colName + colHsn,
                        startX + colSr + colName + colHsn + colQty,
                        startX + colSr + colName + colHsn + colQty + colRate
                    ];
                    headers = ["Sr. No.", "Name of Product / Service", "HSN / SAC", "QTY", "RATE", "TOTAL"];
                }

                // Vertical lines for header (might be invisible on blue bkg but drawing anyway)
                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, tableTop).lineTo(x, tableTop + tableHeaderHeight).stroke(blueColor);
                });

                // Text Color Black
                doc.fillColor(blackColor).fontSize(7);
                headers.forEach((header, i) => {
                    const w = i === headers.length - 1 ? (startX + width - colStartX[i]) : (colStartX[i + 1] - colStartX[i]);
                    doc.text(header, colStartX[i], tableTop + 4, { width: w, align: "center", bold: true });
                });

                // Table Body
                let itemY = tableTop + tableHeaderHeight;
                const tableBodyHeight = 350;

                // Background for Total Column
                if (isPackingList) {
                    // For Packing List, maybe highlight Gross Weight column or leave plain
                    // Based on previous design, column 6 is Gross weight
                    doc.rect(colStartX[6], itemY, colStartX[7] - colStartX[6], tableBodyHeight).fill(lightBlueColor);
                } else {
                    const colTotal = 105; // Standard total width
                    doc.rect(colStartX[5], itemY, colTotal, tableBodyHeight).fill(lightBlueColor);
                }

                doc.rect(startX, itemY, width, tableBodyHeight).stroke(blueColor);

                // Vertical lines for columns
                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, itemY).lineTo(x, itemY + tableBodyHeight).stroke(blueColor);
                });

                document.items.forEach((item, index) => {
                    doc.fillColor(blackColor).fontSize(8);
                    if (isPackingList) {
                        doc.text((index + 1).toString(), colStartX[0], itemY + 5, { width: colStartX[1] - colStartX[0], align: "center" });
                        doc.text(item.productDescription || item.productName || "", colStartX[1] + 5, itemY + 5, { width: colStartX[2] - colStartX[1] - 10, bold: true });
                        doc.text((item.qty || 0).toString(), colStartX[2], itemY + 5, { width: colStartX[3] - colStartX[2], align: "center" });
                        doc.text((item.noOfPackages || 0).toString(), colStartX[3], itemY + 5, { width: colStartX[4] - colStartX[3], align: "center" });
                        doc.text(item.kindOfPackage || "-", colStartX[4], itemY + 5, { width: colStartX[5] - colStartX[4], align: "center" });
                        doc.text((item.netWeight || 0).toFixed(2), colStartX[5], itemY + 5, { width: colStartX[6] - colStartX[5], align: "center" });
                        doc.text((item.grossWeight || 0).toFixed(2), colStartX[6], itemY + 5, { width: colStartX[7] - colStartX[6], align: "center" });
                        doc.text(item.dimensions || "-", colStartX[7], itemY + 5, { width: startX + width - colStartX[7], align: "center" });
                    } else {
                        doc.text((index + 1).toString(), colStartX[0], itemY + 5, { width: colStartX[1] - colStartX[0], align: "center" });
                        doc.text(item.productName || item.productDescription, colStartX[1] + 5, itemY + 5, { width: colStartX[2] - colStartX[1] - 10, bold: true });
                        doc.text((item.hsnSac || item.pkgNo || "-").toString(), colStartX[2], itemY + 5, { width: colStartX[3] - colStartX[2], align: "center" });
                        doc.text(item.qty.toString(), colStartX[3], itemY + 5, { width: colStartX[4] - colStartX[3], align: "center" });
                        doc.text((item.price || 0).toFixed(2), colStartX[4], itemY + 5, { width: colStartX[5] - colStartX[4], align: "center" });
                        doc.text((item.total || 0).toFixed(2), colStartX[5], itemY + 5, { width: colStartX[6] - colStartX[5], align: "center" });
                    }
                    itemY += 15;
                });

                // Table Footer (Total row)
                const tableFooterY = tableTop + tableHeaderHeight + tableBodyHeight;

                // Background for entire Total Row
                doc.rect(startX, tableFooterY, width, 15).fill(lightBlueColor);

                colStartX.slice(1).forEach(x => {
                    doc.moveTo(x, tableFooterY).lineTo(x, tableFooterY + 15).stroke(blueColor);
                });
                doc.rect(startX, tableFooterY, width, 15).stroke(blueColor);
                doc.fillColor(blackColor).fontSize(8).text("Total", startX, tableFooterY + 4, { align: "right", width: colStartX[2] - startX, bold: true });

                if (isPackingList) {
                    const totalQty = document.items.reduce((sum, item) => sum + (item.qty || 0), 0);
                    const totalPkgs = document.items.reduce((sum, item) => sum + (item.noOfPackages || 0), 0);
                    doc.text(totalQty.toFixed(2), colStartX[2], tableFooterY + 4, { width: colStartX[3] - colStartX[2], align: "center", bold: true });
                    doc.text(totalPkgs.toFixed(2), colStartX[3], tableFooterY + 4, { width: colStartX[4] - colStartX[3], align: "center", bold: true });
                    doc.text((document.totals.totalNetWeight || 0).toFixed(2), colStartX[5], tableFooterY + 4, { width: colStartX[6] - colStartX[5], align: "center", bold: true });
                    doc.text((document.totals.totalGrossWeight || 0).toFixed(2), colStartX[6], tableFooterY + 4, { width: colStartX[7] - colStartX[6], align: "center", bold: true });
                } else {
                    const totalQtyList = document.items.reduce((sum, item) => sum + (item.qty || 0), 0);
                    doc.fillColor(blackColor).text(totalQtyList.toString(), colStartX[3], tableFooterY + 4, { width: colStartX[4] - colStartX[3], align: "center", bold: true });
                    doc.text((document.totals.grandTotal || 0).toFixed(2), colStartX[5], tableFooterY + 4, { width: colStartX[6] - colStartX[5], align: "center", bold: true });
                }

                // --- 5. TOTALS SECTION ---
                // Blank Space above Totals
                const preTotalSpaceHeight = 15;
                doc.rect(startX, tableFooterY + 15, width, preTotalSpaceHeight).stroke(blueColor);

                const lowerSectionY = tableFooterY + 15 + preTotalSpaceHeight;
                const wordsWidth = 250;
                const sigSplit = startX + 280;

                if (isPackingList) {
                    const termsY = lowerSectionY;
                    const termsHeight = 110;

                    // --- Left Box: Terms and Conditions ---
                    doc.rect(startX, termsY, (sigSplit - startX), termsHeight).stroke(blueColor);
                    doc.fillColor(blackColor).fontSize(9).text("Terms and Conditions", startX, termsY + 4, { width: (sigSplit - startX), align: "center", bold: true });
                    doc.moveTo(startX, termsY + 18).lineTo(sigSplit, termsY + 18).stroke(blueColor);

                    const fixedTerms = "Subject to our home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\n" +
                        "Goods once sold will not taken back.\nDelivery Ex-Premises.";
                    doc.fontSize(8).text(fixedTerms, startX + 5, termsY + 24, { width: (sigSplit - startX) - 10, lineGap: 3 });

                    // --- Right Box: Weight Totals and Signature ---
                    doc.rect(sigSplit, termsY, (startX + width) - sigSplit, termsHeight).stroke(blueColor);

                    let ry = termsY;
                    const drawWeightRow = (label, value) => {
                        doc.rect(sigSplit, ry, (startX + width) - sigSplit, 15).stroke(blueColor);
                        doc.fillColor(blackColor).fontSize(8).text(label, sigSplit + 5, ry + 4, { bold: true });
                        doc.text(value.toFixed(2), sigSplit, ry + 4, { align: "right", width: (startX + width) - sigSplit - 5, bold: true });
                        ry += 15;
                    };
                    drawWeightRow("Total Package", document.totals.totalPackages || 0);
                    drawWeightRow("Total Gross Weight", document.totals.totalGrossWeight || 0);
                    drawWeightRow("Total Net Weight", document.totals.totalNetWeight || 0);

                    // Certification and Signature Block
                    const sigSectionY = ry;
                    doc.fontSize(7).text("Certified that the particulars given above are true and correct.", sigSplit, sigSectionY + 4, { align: "center", width: (startX + width) - sigSplit, bold: true });
                    doc.fontSize(10).text(`For ${user.companyName || "itcode"}`, sigSplit, sigSectionY + 15, { bold: true, align: "center", width: (startX + width) - sigSplit });

                    // Authorised Signatory label at bottom
                    doc.moveTo(sigSplit, termsY + termsHeight - 15).lineTo(startX + width, termsY + termsHeight - 15).stroke(blueColor);
                    doc.fontSize(8).text("Authorised Signatory", sigSplit, termsY + termsHeight - 12, { align: "center", width: (startX + width) - sigSplit, bold: true });

                } else {
                    doc.rect(startX, lowerSectionY, width, 30).stroke(blueColor);
                    doc.moveTo(startX + wordsWidth, lowerSectionY).lineTo(startX + wordsWidth, lowerSectionY + 30).stroke(blueColor);

                    // --- Left Side: Total in Words ---
                    // Horizontal line for split
                    doc.moveTo(startX, lowerSectionY + 15).lineTo(startX + wordsWidth, lowerSectionY + 15).stroke(blueColor);
                    // Top: Label
                    doc.fillColor(blackColor).fontSize(9).text("Total in words", startX, lowerSectionY + 4, { width: wordsWidth, align: 'center', bold: true });
                    // Bottom: Value
                    doc.fillColor(blackColor).fontSize(7).text(document.totals.totalInWords || "ZERO RUPEES ONLY", startX, lowerSectionY + 19, { width: wordsWidth, align: 'center' });

                    // --- Right Side: Total Amount & E.O.E ---
                    const rX = startX + wordsWidth;
                    const rW = width - wordsWidth;

                    // 1. Total Amount Section (Top Half 15px) - Light Blue BG
                    doc.rect(rX, lowerSectionY, rW, 15).fillAndStroke(lightBlueColor, blueColor);

                    doc.fillColor(blackColor).fontSize(8).text("Total Amount", rX + 5, lowerSectionY + 4, { bold: true });
                    // Using "Rs." as Helvetica doesn't support ₹ symbol
                    const grandTotalVal = (document.totals.grandTotal || 0).toFixed(2);
                    doc.fillColor(blackColor).fontSize(10).text(`Rs. ${grandTotalVal}`, rX, lowerSectionY + 3, { width: rW - 5, align: "right", bold: true });

                    // 2. E & O.E. (Bottom Half 15px)
                    doc.fillColor(blackColor).fontSize(6).text("(E & O.E.)", rX, lowerSectionY + 19, { width: rW - 5, align: "right", bold: true });

                    const termsY = lowerSectionY + 30;
                    const termsHeight = 85; // Height for Terms Section (Left)

                    // Blank Space above Signature (Right Side Only)
                    const sigSpacerHeight = 15;
                    const sigHeight = 70;   // Height for Signature Section (Right)

                    // Vertical Split usually at 250
                    const sigSplitStandard = startX + 250;

                    // --- Left Side: Terms (Height: 85) ---
                    doc.rect(startX, termsY, (sigSplitStandard - startX), termsHeight).stroke(blueColor);

                    // Middle vertical line: Covers Terms, Spacer, and Signature
                    const totalRightHeight = sigSpacerHeight + sigHeight;
                    doc.moveTo(sigSplitStandard, termsY).lineTo(sigSplitStandard, termsY + Math.max(termsHeight, totalRightHeight)).stroke(blueColor);

                    if (!options.hideTerms) {
                        if (isQuotation || isDeliveryChallan || isPurchaseOrder || isSaleOrder || isJobWork) {
                            // For Quotation/Challan/PO/SaleOrder/JobWork: logic to show/hide fixed lines
                            const fixedTerms = "Subject to our home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.";

                            // ONLY show for Quotation, Delivery Challan and Sale Order, NOT for Purchase Order
                            if (!isPurchaseOrder) {
                                doc.fillColor(blackColor).fontSize(8).text(fixedTerms, startX + 5, termsY + 6, { width: (sigSplitStandard - startX) - 10, lineGap: 3 });
                            }
                        } else {
                            // For Sale Invoice Only
                            // 1. Header
                            doc.fillColor(blackColor).fontSize(9).text("Terms and Conditions", startX, termsY + 2, { width: 250, align: "center", bold: true });

                            let termsText = document.termsDetails || "";
                            if (isSaleOrder) {
                                // Remove duplicate sentence if present in user terms
                                termsText = termsText.replace(/Goods once sold will not be taken back\.?/i, "").trim();
                            }

                            doc.fillColor(blackColor).fontSize(8).text(termsText, startX + 5, termsY + 12, { width: (sigSplitStandard - startX) - 10 });

                            // Horizontal Separator inside Left Box
                            // Moved down to prevent overlapping with termsDetails
                            const splitY = termsY + 25;
                            doc.moveTo(startX, splitY).lineTo(sigSplitStandard, splitY).stroke(blueColor);

                            // Bottom Half: Jurisdiction
                            let mandatoryTerms = "";
                            if (isSaleOrder) {
                                // Sale Order: Exclude 'Goods once sold will not taken back'
                                mandatoryTerms = "Subject to our Home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.";
                            } else if (isJobWork) {
                                mandatoryTerms = "Subject to our Home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.";
                            } else {
                                // Tax Invoice: Include all terms
                                mandatoryTerms = "Subject to our Home Jurisdiction.\nOur Responsibility Ceases as soon as goods leaves our Premises.\nGoods once sold will not taken back.\nDelivery Ex-Premises.";
                            }

                            doc.fillColor(blackColor).fontSize(7).text(mandatoryTerms, startX + 5, splitY + 2, { width: (sigSplitStandard - startX) - 10, lineGap: 1 });
                        }
                    }

                    // --- Right Side ---
                    // 1. Spacer Box (Top of Right Side)
                    doc.rect(sigSplitStandard, termsY, (startX + width) - sigSplitStandard, sigSpacerHeight).stroke(blueColor);

                    // 2. Signature Section (Below Spacer)
                    const sigStartY = termsY + sigSpacerHeight;

                    // Right Side Rect
                    doc.rect(sigSplitStandard, sigStartY, (startX + width) - sigSplitStandard, sigHeight).stroke(blueColor);

                    const sigX = sigSplitStandard; // Start X for right side
                    const sigW = (startX + width) - sigSplitStandard;

                    const h1 = 25; // Top section height (Restored)
                    const h2 = 30; // Middle (blank) section height (Restored)
                    const h3 = 10; // Bottom section height (total 80)

                    // Draw Lines
                    // Line after Top Section
                    doc.moveTo(sigX, sigStartY + h1).lineTo(startX + width, sigStartY + h1).stroke(blueColor);
                    // Line after Middle Section
                    doc.moveTo(sigX, sigStartY + h1 + h2).lineTo(startX + width, sigStartY + h1 + h2).stroke(blueColor);

                    // --- Section 1: Certified & Company ---
                    // Certified Text
                    doc.fillColor(blackColor).fontSize(6).text("Certified that the particulars given above are true and correct.", sigX + 5, sigStartY + 4, { width: sigW - 10, align: 'center', bold: true });
                    // For Company
                    doc.fontSize(9).text(`For ${user.companyName || "ITCode"}`, sigX, sigStartY + 13, { bold: true, align: "center", width: sigW });

                    // --- Section 3: Authorized Signatory ---
                    doc.fontSize(7).text("Authorized signatory", sigX, sigStartY + h1 + h2 + 4, { align: "center", width: sigW, bold: true });
                }
            });
        });

        doc.end();
    });
};

module.exports = { generateSaleInvoicePDF };