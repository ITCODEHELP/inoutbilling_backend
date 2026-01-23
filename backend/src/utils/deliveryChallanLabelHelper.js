const PDFDocument = require('pdfkit');

/**
 * Generates an Envelope or Shipping Label PDF for a Delivery Challan.
 * @param {Object} challan - Delivery Challan document.
 * @param {Object} user - Company/Sender details.
 * @param {String} type - 'SHIPPING' or 'ENVELOPE'.
 * @param {String} size - 'Small', 'Medium', 'Large'.
 * @returns {Promise<Buffer>}
 */
const generateLabelPDF = (challan, user, type = 'SHIPPING', size = 'Medium') => {
    return new Promise((resolve, reject) => {
        // Base sizes (Width only is strict for Shipping, Height is dynamic)
        const sizes = {
            'Small': [400, 300],
            'Medium': [600, 450],
            'Large': [800, 600]
        };

        const width = (sizes[size] || sizes['Medium'])[0];

        // Base width for scaling calculations (Reference: Medium)
        const baseWidth = 600;
        const scale = width / baseWidth;

        // Styling constants
        const margin = 20 * scale;
        const cornerRadius = 10 * scale;
        const strokeWidth = 1.5 * scale;
        const dividerWidth = 1.5 * scale;

        // Fonts
        const fontRegular = 'Helvetica';
        const fontBold = 'Helvetica-Bold';

        // Font Sizes
        const fsHeader = 10 * scale;
        const fsContentLarge = 14 * scale;
        const fsContentNormal = 9 * scale;
        const fsTableHead = 9 * scale;
        const fsTableRow = 9 * scale;

        // Instantiate Doc with no page initially to allow calculations
        const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        if (type === 'ENVELOPE') {
            // --- ENVELOPE (Fixed Sizes) ---
            const envelopeSizes = {
                'Small': [650, 350],
                'Medium': [820, 450],
                'Large': [900, 600]
            };
            const envSize = envelopeSizes[size] || envelopeSizes['Medium'];
            doc.addPage({ size: envSize, margin: 0 });

            const envWidth = envSize[0];
            const envHeight = envSize[1];

            // 1. RECIPIENT
            const toX = 50 * scale;
            let toY = 50 * scale;

            doc.font(fontBold).fontSize(12 * scale).text("TO:", toX, toY);
            toY += 20 * scale;

            doc.text((challan.customerInformation.ms || "").toUpperCase(), toX, toY);
            toY += 15 * scale;

            doc.font(fontRegular).fontSize(10 * scale);
            const cust = challan.customerInformation;
            const recipientAddr = [
                cust.address, cust.city, cust.state, cust.country, cust.pincode
            ].filter(Boolean).join(', ').toUpperCase();

            doc.text(recipientAddr, toX, toY, { width: envWidth * 0.5 });

            // 2. SENDER
            const fromX = envWidth * 0.55;
            let fromY = envHeight * 0.6;

            doc.font(fontBold).fontSize(11 * scale).text("FROM:", fromX, fromY);
            fromY += 15 * scale;

            doc.text((user.companyName || "").toUpperCase(), fromX, fromY, { underline: true });
            fromY += 15 * scale;

            doc.font(fontRegular).fontSize(9 * scale);
            const userAddr = [
                user.address, user.city, user.state, user.pincode
            ].filter(Boolean).join(', ').toUpperCase();

            doc.text(userAddr, fromX, fromY, { width: envWidth * 0.4 });
            fromY += doc.heightOfString(userAddr, { width: envWidth * 0.4 }) + 5;

            if (user.phone) {
                doc.text(`PH: ${user.phone}`, fromX, fromY);
            }

        } else {
            // --- SHIPPING LABEL (Dynamic Height) ---

            const contentLeft = margin + (15 * scale);
            const contentRight = width - margin - (15 * scale);
            const contentWidth = contentRight - contentLeft;

            // --- CALCULATE HEIGHT ---
            let calcY = margin + (15 * scale);

            // TO Section
            calcY += (fsHeader + (5 * scale)); // Header TO
            calcY += (fsContentLarge + (5 * scale)); // Name

            // Address Height
            doc.font(fontRegular).fontSize(fsContentNormal);
            const cust = challan.customerInformation;
            const custAddr = [
                cust.address, cust.city, cust.state, cust.country, cust.pincode
            ].filter(Boolean).join(', ').toUpperCase();

            calcY += doc.heightOfString(custAddr, { width: contentWidth }) + (10 * scale);

            // Divider + Padding
            calcY += (10 * scale);

            // FROM Section
            calcY += (fsHeader + (5 * scale)); // Header FROM
            calcY += (fsContentLarge + (5 * scale)); // Comp Name

            // Comp Address
            const userAddr = [
                user.address, user.city, user.state, user.pincode
            ].filter(Boolean).join(', ').toUpperCase();
            calcY += doc.heightOfString(userAddr, { width: contentWidth }) + (3 * scale);

            // Contact & Phone
            const contactPerson = user.contactPerson || user.fullName || user.username || "";
            if (contactPerson) {
                calcY += (fsContentNormal + (3 * scale));
            }
            if (user.phone) {
                calcY += (fsContentNormal + (3 * scale));
            }
            calcY += (5 * scale);

            // Divider + Padding
            calcY += (10 * scale);

            // Document Details
            calcY += (fsHeader + (8 * scale)); // Header
            calcY += (fsContentNormal + (10 * scale)); // Row + Padding

            // Divider + Padding
            calcY += (10 * scale);

            // Item Details
            calcY += (fsHeader + (10 * scale)); // Header
            calcY += (fsTableHead + (5 * scale)); // Table Head
            calcY += (8 * scale); // SubDivider padding

            // Items Rows
            const items = challan.items || [];
            if (items.length > 0) {
                // Assuming single line usually, but lets match drawing logic
                // Standard row height per item
                const rowHeight = fsTableRow + (8 * scale);
                calcY += (items.length * rowHeight);
            } else {
                // Minimal height if no items?
                calcY += (fsTableRow + (8 * scale));
            }

            // Bottom Margin
            calcY += (15 * scale); // Space before border
            calcY += margin; // Bottom margin outside border

            const totalHeight = calcY;

            // --- DRAW CONTENT ---
            doc.addPage({ size: [width, totalHeight], margin: 0 });

            // Draw Border
            doc.lineWidth(strokeWidth);
            doc.roundedRect(margin, margin, width - (2 * margin), totalHeight - (2 * margin), cornerRadius).stroke();

            let currentY = margin + (15 * scale);

            // TO
            doc.font(fontBold).fontSize(fsHeader).text("TO", contentLeft, currentY, { underline: true });
            currentY += fsHeader + (5 * scale);

            doc.font(fontBold).fontSize(fsContentLarge).text((challan.customerInformation.ms || "").toUpperCase(), contentLeft, currentY);
            currentY += fsContentLarge + (5 * scale);

            doc.font(fontRegular).fontSize(fsContentNormal);
            doc.text(custAddr, contentLeft, currentY, { width: contentWidth });
            currentY += doc.heightOfString(custAddr, { width: contentWidth }) + (10 * scale);

            // Divider
            doc.moveTo(margin, currentY).lineTo(width - margin, currentY).lineWidth(dividerWidth).stroke();
            currentY += (10 * scale);

            // FROM
            doc.font(fontBold).fontSize(fsHeader).text("FROM", contentLeft, currentY, { underline: true });
            currentY += fsHeader + (5 * scale);

            doc.font(fontBold).fontSize(fsContentLarge).text((user.companyName || "").toUpperCase(), contentLeft, currentY);
            currentY += fsContentLarge + (5 * scale);

            doc.font(fontRegular).fontSize(fsContentNormal);
            doc.text(userAddr, contentLeft, currentY, { width: contentWidth });
            currentY += doc.heightOfString(userAddr, { width: contentWidth }) + (3 * scale);

            if (contactPerson) {
                doc.text(`CONTACT PERSON : ${contactPerson.toUpperCase()}`, contentLeft, currentY);
                currentY += fsContentNormal + (3 * scale);
            }

            if (user.phone) {
                doc.text(`PHONE : ${user.phone}`, contentLeft, currentY);
                currentY += fsContentNormal + (3 * scale);
            }
            currentY += (5 * scale);

            // Divider
            doc.moveTo(margin, currentY).lineTo(width - margin, currentY).lineWidth(dividerWidth).stroke();
            currentY += (10 * scale);

            // Document Details
            doc.font(fontBold).fontSize(fsHeader).text("DOCUMENT DETAILS", contentLeft, currentY, { underline: true });
            currentY += fsHeader + (8 * scale);

            const docDetailsY = currentY;
            doc.font(fontBold).fontSize(fsContentNormal).text("CHALLAN NO.:", contentLeft, docDetailsY);
            const challanNoWidth = doc.widthOfString("CHALLAN NO.:");
            doc.font(fontRegular).text(`  ${challan.deliveryChallanDetails.challanNumber}`, contentLeft + challanNoWidth, docDetailsY);

            const dateLabelX = contentLeft + (200 * scale);
            doc.font(fontBold).text("CHALLAN DATE:", dateLabelX, docDetailsY);
            const dateLabelWidth = doc.widthOfString("CHALLAN DATE:");
            const dateVal = challan.deliveryChallanDetails.date ? new Date(challan.deliveryChallanDetails.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase().replace(/ /g, '-') : '';
            doc.font(fontRegular).text(`  ${dateVal}`, dateLabelX + dateLabelWidth, docDetailsY);

            currentY += fsContentNormal + (10 * scale);

            // Divider
            doc.moveTo(margin, currentY).lineTo(width - margin, currentY).lineWidth(dividerWidth).stroke();
            currentY += (10 * scale);

            // Item Details
            doc.font(fontBold).fontSize(fsHeader).text("ITEM DETAILS", contentLeft, currentY, { underline: true });
            currentY += fsHeader + (10 * scale);

            const colX_Sr = contentLeft;
            const colX_Name = contentLeft + (40 * scale);
            const colX_Hsn = contentLeft + (350 * scale);
            const colX_Qty = contentRight - (50 * scale);

            doc.font(fontBold).fontSize(fsTableHead);
            doc.text("SR. NO.", colX_Sr, currentY);
            doc.text("NAME OF PRODUCT / SERVICE", colX_Name, currentY);
            doc.text("HSN / SAC", colX_Hsn, currentY);
            doc.text("QTY", colX_Qty, currentY);

            currentY += fsTableHead + (5 * scale);

            doc.lineWidth(0.5 * scale).moveTo(margin, currentY).lineTo(width - margin, currentY).stroke();
            currentY += (8 * scale);

            // Items
            doc.font(fontRegular).fontSize(fsTableRow);
            items.forEach((item, index) => {
                doc.text((index + 1).toString(), colX_Sr, currentY);
                doc.text((item.productName || "").toUpperCase(), colX_Name, currentY, { width: colX_Hsn - colX_Name - 10 });
                doc.text(item.hsnSac || "-", colX_Hsn, currentY);
                doc.text((item.qty || 0).toFixed(2), colX_Qty, currentY);

                currentY += fsTableRow + (8 * scale);
            });
        }

        doc.end();
    });
};

module.exports = { generateLabelPDF };
