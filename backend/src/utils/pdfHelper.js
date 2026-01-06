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

/**
 * Generates a simple receipt PDF (for Expenses/Other Income).
 */
const generateReceiptPDF = (data, type = "EXPENSE") => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        doc.fillColor("#444444")
            .fontSize(20)
            .text(`${type} VOUCHER`, 50, 50, { align: "right" })
            .fontSize(10)
            .text(`No: ${data.no}`, 50, 50)
            .text(`Date: ${new Date(data.date).toLocaleDateString()}`, 50, 65)
            .moveDown();

        doc.moveTo(50, 90).lineTo(550, 90).stroke();

        doc.fontSize(12).fillColor("#000000").text("Details:", 50, 110);
        doc.fontSize(10).text(`Category: ${data.category}`, 50, 125);
        doc.text(`Payment: ${data.paymentType}`, 50, 140);
        if (data.remarks) doc.text(`Remarks: ${data.remarks}`, 50, 155);

        const tableTop = 200;
        doc.fontSize(10).fillColor("#444444")
            .text("Description", 50, tableTop)
            .text("Amount", 450, tableTop, { width: 100, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 30;
        data.items.forEach(item => {
            doc.fillColor("#000000")
                .text(item.name, 50, y, { width: 350 })
                .text(item.amount.toFixed(2), 450, y, { width: 100, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();
        y += 25;
        doc.fontSize(12).fillColor("#000000")
            .text("Total:", 350, y)
            .text(`${data.grandTotal.toFixed(2)}`, 450, y, { width: 100, align: "right" });

        if (data.amountInWords) {
            y += 25;
            doc.fontSize(10).text(`In Words: ${data.amountInWords}`, 50, y);
        }

        if (data.customFields && data.customFields.length > 0) {
            y += 20;
            data.customFields.forEach(cf => {
                doc.fontSize(10).text(`${cf.name}: ${cf.value}`, 50, y);
                y += 15;
            });
        }

        doc.end();
    });
};

/**
 * Generates a Quotation PDF as a Buffer.
 * @param {Object} data - The quotation data object.
 * @returns {Promise<Buffer>}
 */
const generateQuotationPDF = (data) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fillColor("#444444")
            .fontSize(20)
            .text("QUOTATION", 50, 50, { align: "right" })
            .fontSize(10)
            .text(`Quotation No: ${data.quotationDetails.quotationNumber}`, 50, 50)
            .text(`Date: ${new Date(data.quotationDetails.date).toLocaleDateString()}`, 50, 65)
            .text(`Delivery Mode: ${data.quotationDetails.deliveryMode}`, 50, 80)
            .moveDown();

        doc.moveTo(50, 100).lineTo(550, 100).stroke();

        // Customer Info
        doc.fontSize(12).fillColor("#000000").text("Customer Information:", 50, 120);
        doc.fontSize(10)
            .text(data.customerInformation.ms, 50, 135)
            .text(data.customerInformation.address || "", 50, 150)
            .text(`GSTIN/PAN: ${data.customerInformation.gstinPan || ""}`, 50, 165);

        // Transport Details (if applicable)
        if (data.transportDetails && data.transportDetails.transportName) {
            doc.fontSize(12).text("Transport Details:", 300, 120);
            doc.fontSize(10)
                .text(`Transport: ${data.transportDetails.transportName}`, 300, 135)
                .text(`Vehicle No: ${data.transportDetails.vehicleNo || "N/A"}`, 300, 150)
                .text(`Doc No: ${data.transportDetails.documentNo || "N/A"}`, 300, 165);
        }

        // Table Header
        const tableTop = 210;
        doc.fontSize(10).fillColor("#444444")
            .text("Product", 50, tableTop)
            .text("Qty", 250, tableTop, { width: 50, align: "right" })
            .text("Price", 320, tableTop, { width: 70, align: "right" })
            .text("Tax", 400, tableTop, { width: 50, align: "right" })
            .text("Total", 480, tableTop, { width: 70, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 30;
        data.items.forEach(item => {
            doc.fillColor("#000000")
                .text(item.productName, 50, y, { width: 200 })
                .text(item.qty.toString(), 250, y, { width: 50, align: "right" })
                .text(item.price.toFixed(2), 320, y, { width: 70, align: "right" })
                .text(((item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)).toFixed(2), 400, y, { width: 50, align: "right" })
                .text(item.total.toFixed(2), 480, y, { width: 70, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();

        // Totals
        y += 25;
        doc.fontSize(12).fillColor("#000000")
            .text("Grand Total:", 350, y)
            .text(`${data.totals.grandTotal.toFixed(2)}`, 450, y, { width: 100, align: "right" });

        if (data.totals.totalInWords) {
            y += 25;
            doc.fontSize(10).text(`In Words: ${data.totals.totalInWords}`, 50, y);
        }

        doc.end();
    });
};

/**
 * Generates a Proforma PDF as a Buffer.
 * @param {Object} data - The proforma data object.
 * @returns {Promise<Buffer>}
 */
const generateProformaPDF = (data) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fillColor("#444444")
            .fontSize(20)
            .text("PROFORMA INVOICE", 50, 50, { align: "right" })
            .fontSize(10)
            .text(`Proforma No: ${data.proformaDetails.proformaNumber}`, 50, 50)
            .text(`Date: ${new Date(data.proformaDetails.date).toLocaleDateString()}`, 50, 65)
            .text(`Delivery Mode: ${data.proformaDetails.deliveryMode}`, 50, 80)
            .moveDown();

        doc.moveTo(50, 100).lineTo(550, 100).stroke();

        // Customer Info
        doc.fontSize(12).fillColor("#000000").text("Customer Information:", 50, 120);
        doc.fontSize(10)
            .text(data.customerInformation.ms, 50, 135)
            .text(data.customerInformation.address || "", 50, 150)
            .text(`GSTIN/PAN: ${data.customerInformation.gstinPan || ""}`, 50, 165);

        // Transport Details (if applicable)
        if (data.transportDetails && data.transportDetails.transportName) {
            doc.fontSize(12).text("Transport Details:", 300, 120);
            doc.fontSize(10)
                .text(`Transport: ${data.transportDetails.transportName}`, 300, 135)
                .text(`Vehicle No: ${data.transportDetails.vehicleNo || "N/A"}`, 300, 150)
                .text(`Doc No: ${data.transportDetails.documentNo || "N/A"}`, 300, 165);
        }

        // Table Header
        const tableTop = 210;
        doc.fontSize(10).fillColor("#444444")
            .text("Product", 50, tableTop)
            .text("Qty", 250, tableTop, { width: 50, align: "right" })
            .text("Price", 320, tableTop, { width: 70, align: "right" })
            .text("Tax", 400, tableTop, { width: 50, align: "right" })
            .text("Total", 480, tableTop, { width: 70, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 30;
        data.items.forEach(item => {
            doc.fillColor("#000000")
                .text(item.productName, 50, y, { width: 200 })
                .text(item.qty.toString(), 250, y, { width: 50, align: "right" })
                .text(item.price.toFixed(2), 320, y, { width: 70, align: "right" })
                .text(((item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)).toFixed(2), 400, y, { width: 50, align: "right" })
                .text(item.total.toFixed(2), 480, y, { width: 70, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();

        // Totals
        y += 25;
        doc.fontSize(12).fillColor("#000000")
            .text("Grand Total:", 350, y)
            .text(`${data.totals.grandTotal.toFixed(2)}`, 450, y, { width: 100, align: "right" });

        if (data.totals.totalInWords) {
            y += 25;
            doc.fontSize(10).text(`In Words: ${data.totals.totalInWords}`, 50, y);
        }

        doc.end();
    });
};

/**
 * Generates a Delivery Challan PDF as a Buffer.
 * @param {Object} data - The delivery challan data object.
 * @returns {Promise<Buffer>}
 */
const generateDeliveryChallanPDF = (data) => {
    return new Promise((resolve, reject) => {
        const PDFDocument = require('pdfkit');
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // Header
        doc.fillColor("#444444")
            .fontSize(20)
            .text("DELIVERY CHALLAN", 50, 50, { align: "right" })
            .fontSize(10)
            .text(`Challan No: ${data.deliveryChallanDetails.challanNumber}`, 50, 50)
            .text(`Date: ${new Date(data.deliveryChallanDetails.date).toLocaleDateString()}`, 50, 65)
            .text(`Delivery Mode: ${data.deliveryChallanDetails.deliveryMode}`, 50, 80)
            .moveDown();

        doc.moveTo(50, 100).lineTo(550, 100).stroke();

        // Customer Info
        doc.fontSize(12).fillColor("#000000").text("Customer Information:", 50, 120);
        doc.fontSize(10)
            .text(data.customerInformation.ms, 50, 135)
            .text(data.customerInformation.address || "", 50, 150)
            .text(`GSTIN/PAN: ${data.customerInformation.gstinPan || ""}`, 50, 165);

        // Transport Details
        if (data.transportDetails && data.transportDetails.transportName) {
            doc.fontSize(12).text("Transport Details:", 300, 120);
            doc.fontSize(10)
                .text(`Transport: ${data.transportDetails.transportName}`, 300, 135)
                .text(`Vehicle No: ${data.transportDetails.vehicleNo || "N/A"}`, 300, 150)
                .text(`Doc No: ${data.transportDetails.documentNo || "N/A"}`, 300, 165);
        }

        // Table Header
        const tableTop = 210;
        doc.fontSize(10).fillColor("#444444")
            .text("Product", 50, tableTop)
            .text("Qty", 250, tableTop, { width: 50, align: "right" })
            .text("Price", 320, tableTop, { width: 70, align: "right" })
            .text("Tax", 400, tableTop, { width: 50, align: "right" })
            .text("Total", 480, tableTop, { width: 70, align: "right" });

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        let y = tableTop + 30;
        data.items.forEach(item => {
            doc.fillColor("#000000")
                .text(item.productName, 50, y, { width: 200 })
                .text(item.qty.toString(), 250, y, { width: 50, align: "right" })
                .text(item.price.toFixed(2), 320, y, { width: 70, align: "right" })
                .text(((item.igst || 0) + (item.cgst || 0) + (item.sgst || 0)).toFixed(2), 400, y, { width: 50, align: "right" })
                .text(item.total.toFixed(2), 480, y, { width: 70, align: "right" });
            y += 20;
        });

        doc.moveTo(50, y + 10).lineTo(550, y + 10).stroke();

        // Totals
        y += 25;
        doc.fontSize(12).fillColor("#000000")
            .text("Grand Total:", 350, y)
            .text(`${data.totals.grandTotal.toFixed(2)}`, 450, y, { width: 100, align: "right" });

        if (data.totals.totalInWords) {
            y += 25;
            doc.fontSize(10).text(`In Words: ${data.totals.totalInWords}`, 50, y);
        }

        doc.end();
    });
};

module.exports = { generateInvoicePDF, generateReceiptPDF, generateQuotationPDF, generateProformaPDF, generateDeliveryChallanPDF };

