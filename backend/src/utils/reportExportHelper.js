const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const nodemailer = require('nodemailer');
const excel = require('exceljs');

// --- Helper Functions ---

/**
 * Get value from object by dotted path (e.g. "customerInformation.name")
 * @param {Object} obj 
 * @param {String} path 
 * @returns {any}
 */
const getValue = (obj, path) => {
    if (!path || !obj) return '';
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Format date to DD-MMM-YYYY
 * @param {String|Date} dateStr 
 * @returns {String}
 */
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
};

/**
 * Format number to currency (Indian format approx)
 * @param {Number} num 
 * @returns {String}
 */
const formatNumber = (num) => {
    if (typeof num !== 'number') return num || '0.00';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Format camelCase to Title Case
 * @param {String} text 
 * @returns {String}
 */
const formatHeader = (text) => {
    if (!text) return '';
    // Remove dots for cleaner headers if using dotted paths
    const cleanText = text.split('.').pop();
    return cleanText
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
};

// --- HTML Generation ---

/**
 * Generate HTML for Reports (Print/PDF)
 */
const generateReportHtml = ({ data, columns, reportTitle, filters, companyInfo, summary }) => {
    const rows = data || [];
    const dateRangeStr = filters.fromDate && filters.toDate
        ? `${formatDate(filters.fromDate)} to ${formatDate(filters.toDate)}`
        : 'All Dates';

    // Company Details
    const companyName = companyInfo?.companyName || 'Company Name';
    const address = companyInfo?.address || '';
    const city = companyInfo?.city || '';
    const fullAddress = `${address}${city ? `, ${city}` : ''}`;

    // Headers
    const headersHtml = columns.map(col => {
        const alignClass = (col.type === 'number' || col.field.includes('amount') || col.field.includes('Total') || col.field.includes('price')) ? 'text-right' : 'text-left';
        return `<th class="${alignClass}">${col.label}</th>`;
    }).join('');

    // Rows
    const rowsHtml = rows.map(row => {
        const cells = columns.map(col => {
            let val = getValue(row, col.field);
            const alignClass = (col.type === 'number' || col.field.includes('amount') || col.field.includes('Total') || col.field.includes('price')) ? 'text-right' : 'text-left';

            // Auto-format based on field name or value type
            if (col.field.toLowerCase().includes('date')) val = formatDate(val);
            else if (typeof val === 'number') val = formatNumber(val);
            else if (val === undefined || val === null) val = '';

            return `<td class="${alignClass}">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    // Summary Footer
    let summaryHtml = '';
    if (summary && Object.keys(summary).length > 0) {
        summaryHtml = `
            <tfoot>
                <tr class="summary-row">
                    <td colspan="${Math.max(1, columns.length - 2)}">
                        <strong>Total Records:</strong> ${summary.totalInvoices || summary.totalDocuments || rows.length}
                    </td>
                    <td class="text-right" colspan="2">
                        <strong>Grand Total:</strong> ${summary.grandTotal ? formatNumber(summary.grandTotal) : ''}
                    </td>
                </tr>
            </tfoot>
        `;
    }

    // Exact Layout Structure
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #333; margin: 0; padding: 20px; }
        .header-container { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .company-section { text-align: left; }
        .title-section { text-align: center; flex-grow: 1; }
        
        h3 { margin: 0; font-size: 18px; font-weight: bold; }
        h2 { margin: 0; font-size: 22px; font-weight: bold; }
        p { margin: 2px 0; color: #555; }
        
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
        th { border-bottom: 2px solid #000; padding: 8px; font-weight: bold; text-align: left; }
        td { border-bottom: 1px solid #eee; padding: 8px; vertical-align: top; }
        
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        
        .summary-row td { border-top: 2px solid #000; padding: 10px 8px; font-weight: bold; background-color: #f9f9f9; }
        
        @media print {
            body { padding: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header-container">
        <div class="company-section">
            <h3>${companyName}</h3>
            <p>${fullAddress}</p>
        </div>
        <div class="title-section">
            <h2>${reportTitle}</h2>
            <p>${dateRangeStr}</p>
        </div>
    </div>

    <table>
        <thead>
            <tr>${headersHtml}</tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
        ${summaryHtml}
    </table>
</body>
</html>
    `;
};

// --- PDF Generation ---

const generateReportPdf = async (params) => {
    const html = generateReportHtml(params);
    const { columns } = params;

    // Auto-detect orientation
    const landscape = columns.length > 5;

    return await convertHtmlToPdf(html, {
        format: 'A4',
        landscape,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        printBackground: true,
        width: landscape ? 1123 : 794
    });
};

// --- Excel Generation ---

const generateReportExcel = async ({ data, columns, reportTitle, filters, companyInfo, summary }) => {
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // Setup Columns
    worksheet.columns = columns.map(col => ({
        header: col.label,
        key: col.field,
        width: Math.max(col.label.length + 5, 15)
    }));

    // Data must start from row 7 (as per requirement)
    // However, header row is usually managed by worksheet.columns.
    // We will manually manage rows to match exact structure.

    // Clear initial columns setup to fully control layout
    worksheet.columns = [];

    // --- Header Section ---
    // Row 1: Company Name
    worksheet.mergeCells('A1', 'E1');
    const r1 = worksheet.getCell('A1');
    r1.value = companyInfo?.companyName || 'Company Name';
    r1.font = { name: 'Arial', size: 16, bold: true };
    r1.alignment = { horizontal: 'left' };

    // Row 2: Company Address
    worksheet.mergeCells('A2', 'E2');
    const r2 = worksheet.getCell('A2');
    r2.value = `${companyInfo?.address || ''} ${companyInfo?.city || ''}`;
    r2.font = { name: 'Arial', size: 12 };
    r2.alignment = { horizontal: 'left' };

    // Row 3: Report Title
    worksheet.mergeCells('A3', 'E3');
    const r3 = worksheet.getCell('A3');
    r3.value = reportTitle;
    r3.font = { name: 'Arial', size: 14, bold: true };
    r3.alignment = { horizontal: 'center' };

    // Row 4: Date Range
    const dateRangeStr = filters.fromDate && filters.toDate
        ? `${formatDate(filters.fromDate)} to ${formatDate(filters.toDate)}`
        : 'All Dates';
    worksheet.mergeCells('A4', 'E4');
    const r4 = worksheet.getCell('A4');
    r4.value = dateRangeStr;
    r4.font = { name: 'Arial', size: 12 };
    r4.alignment = { horizontal: 'center' };

    // Row 5: Empty
    worksheet.addRow([]);

    // Row 6: Headers
    const headerRow = worksheet.getRow(6);
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.label;
        cell.font = { bold: true };
        cell.border = { bottom: { style: 'thin' } };
        // Set width
        worksheet.getColumn(i + 1).width = Math.max(col.label.length + 5, 20);
    });

    // Row 7+: Data
    let currentRowIdx = 7;
    data.forEach(row => {
        const currentRow = worksheet.getRow(currentRowIdx);
        columns.forEach((col, i) => {
            let val = getValue(row, col.field);
            const cell = currentRow.getCell(i + 1);

            // Format Dates
            if (col.field.toLowerCase().includes('date')) {
                if (val) {
                    // Attempt to convert to date object for Excel date type
                    const d = new Date(val);
                    if (!isNaN(d.getTime())) {
                        cell.value = d;
                        cell.numFmt = 'dd-mmm-yyyy';
                    } else {
                        cell.value = val;
                    }
                }
            }
            // Format Numbers
            else if (typeof val === 'number') {
                cell.value = val;
                cell.numFmt = '#,##0.00';
            }
            else {
                cell.value = val;
            }
        });
        currentRowIdx++;
    });

    // Last Row: Totals
    if (summary) {
        currentRowIdx++;
        const totalRow = worksheet.getRow(currentRowIdx);
        totalRow.getCell(1).value = `Total Records: ${summary.totalInvoices || summary.totalDocuments || data.length}`;
        totalRow.getCell(1).font = { bold: true };

        if (summary.grandTotal) {
            // Assume Grand Total goes to the last column or specific column
            // We'll put it in the last column of the table
            const lastColIdx = columns.length;
            const totalCell = totalRow.getCell(lastColIdx);
            totalCell.value = summary.grandTotal;
            totalCell.numFmt = '#,##0.00';
            totalCell.font = { bold: true };

            // Add label before it
            if (lastColIdx > 1) {
                const labelCell = totalRow.getCell(lastColIdx - 1);
                labelCell.value = 'Grand Total:';
                labelCell.font = { bold: true };
                labelCell.alignment = { horizontal: 'right' };
            }
        }
    }

    return await workbook.xlsx.writeBuffer();
};

// --- Email ---

const sendReportEmail = async (params) => {
    const { email, reportTitle, message, companyInfo } = params;

    if (!email) throw new Error('Recipient email is required');

    const pdfBuffer = await generateReportPdf(params);

    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: { rejectUnauthorized: false }
    });

    const sanitizedTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${sanitizedTitle}.pdf`;

    const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to: email,
        subject: `${reportTitle}`,
        text: message || `Please find attached the ${reportTitle}.`,
        attachments: [
            {
                filename,
                content: pdfBuffer,
                contentType: 'application/pdf'
            }
        ]
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = {
    generateReportHtml,
    generateReportPdf,
    generateReportExcel,
    sendReportEmail,
    formatHeader,
    getValue
};
