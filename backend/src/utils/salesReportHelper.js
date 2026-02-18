const excel = require('exceljs');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');

/**
 * Get value from object by path (e.g. "customerInformation.ms")
 */
const getValue = (obj, path) => {
    if (!path || !obj) return '';
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

/**
 * Get all leaf paths from an object to determine headers if not provided
 */
const getLeafPaths = (obj, prefix = '') => {
    let paths = [];
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof val === 'object' && val !== null && !Array.isArray(val) && !(val instanceof Date)) {
                paths = paths.concat(getLeafPaths(val, newKey));
            } else {
                paths.push(newKey);
            }
        }
    }
    return paths;
};

/**
 * Format header key to human readable label
 */
const formatHeader = (key) => {
    // Remove common prefixes
    let label = key
        .replace('customerInformation.', 'Customer ')
        .replace('invoiceDetails.', 'Invoice ')
        .replace('totals.', '')
        .replace('items.', 'Item ');

    // Camel case to words
    label = label
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();

    return label;
};

/**
 * Generate styled HTML string for Sales Report
 */
/**
 * Generate styled HTML string for Sales Report
 */
const generateSalesReportHtml = (data, filters, user = {}) => {
    const { reports, summary } = data;

    // Date formatting helper (DD-MMM-YYYY)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    };

    // Date Range for Title
    const dateRangeStr = filters.dateRange
        ? `${formatDate(filters.dateRange.from)} to ${formatDate(filters.dateRange.to)}`
        : 'All Dates';

    // Company Details (Dynamic)
    const companyName = user.companyName || 'Company Name';
    const address = user.address || '';
    const city = user.city || '';

    // Flatten logic for table rows
    let flattenedRows = [];
    if (reports.length > 0) {
        if (reports[0].invoices && Array.isArray(reports[0].invoices)) {
            // Grouped Data: Flatten for the list view
            reports.forEach(group => {
                group.invoices.forEach(inv => {
                    // Inject customer name if missing in invoice but present in group
                    if (!inv.customerInformation) inv.customerInformation = {};
                    if (!inv.customerInformation.ms && group.customer) {
                        inv.customerInformation.ms = group.customer;
                    }
                    flattenedRows.push(inv);
                });
            });
        } else {
            // Flat Data
            flattenedRows = reports;
        }
    }

    // Generate Rows HTML
    const rowsHtml = flattenedRows.map(row => {
        const vchType = row.invoiceDetails?.invoiceType || 'Sales';
        const invoiceNo = row.invoiceDetails?.invoiceNumber || '';
        const invoiceDate = formatDate(row.invoiceDetails?.date);
        const customerName = row.customerInformation?.ms || '';
        // Values are already formatted strings from model? 
        // Logic says "Reuse existing data returned from SalesReportModel... (already formatted)".
        // But if I flattened it manually above, I might be accessing raw objects if they weren't formatted recursively?
        // usages: model calls formatRecursive. So they should be formatted strings like "1,234.00".
        // Wait, formatRecursive updates the object in place. So yes.
        const taxable = row.totals?.totalTaxable || '0.00';
        const grandTotal = row.totals?.grandTotal || '0.00';

        return `
            <tr>
                <td>${vchType}</td>
                <td>${invoiceNo}</td>
                <td>${invoiceDate}</td>
                <td>${customerName}</td>
                <td class="text-right">${taxable}</td>
                <td class="text-right">${grandTotal}</td>
            </tr>
        `;
    }).join('');

    // Summary Data
    const totalDocs = summary?.totalInvoices || 0;
    const totalTaxable = summary?.taxableValueTotal || '0.00';
    const totalGrand = summary?.grandTotal || '0.00';

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 20px; }
                .report-container { width: 100%; }
                
                /* Header */
                .header-left { text-align: left; margin-bottom: 20px; }
                .header-left .company-name { font-size: 16px; font-weight: bold; margin-bottom: 5px; }
                .header-left div { margin-bottom: 2px; }

                /* Title */
                .report-title { text-align: center; margin-bottom: 20px; }
                .report-title h2 { margin: 0 0 5px 0; font-size: 18px; }
                .report-title div { font-size: 14px; }

                /* Table */
                table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                th { border-bottom: 1px solid #ccc; padding: 8px; text-align: left; font-weight: bold; }
                td { padding: 6px; border-bottom: 1px solid #eee; text-align: left; }
                
                .text-right { text-align: right; }
                
                /* Summary */
                tfoot tr td { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 10px 6px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="report-container">

                <div class="header-left">
                    <div class="company-name">${companyName}</div>
                    <div>${address}</div>
                    <div>${city}</div>
                </div>

                <div class="report-title">
                    <h2>Sales Register</h2>
                    <div>${dateRangeStr}</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th>Vch Type</th>
                            <th>Invoice No</th>
                            <th>Invoice Date</th>
                            <th>Company Name</th>
                            <th class="text-right">Taxable Value Total</th>
                            <th class="text-right">Grand Total</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${rowsHtml}
                    </tbody>

                    <tfoot>
                        <tr>
                            <td colspan="4">${totalDocs} Documents</td>
                            <td class="text-right">${totalTaxable}</td>
                            <td class="text-right">${totalGrand}</td>
                        </tr>
                    </tfoot>
                </table>

            </div>
        </body>
        </html>
    `;
};

const generateRowsHtml = (reports, headers) => {
    return reports.map(row => {
        // Handle Grouped Data
        if (row.invoices && Array.isArray(row.invoices)) {
            // It's a group
            // Show Group Header with ID?
            let groupId = '';
            if (row._id) {
                if (typeof row._id === 'object') groupId = JSON.stringify(row._id);
                else groupId = row._id;
            } else {
                groupId = 'Group';
            }

            // Generate rows for this group
            // We can add a group header row
            const groupHeader = `
                <tr class="group-header">
                    <td colspan="${headers.length}">
                        ${groupId} (Total: ${row.totalInvoices || 0}, Amount: ${row.totalGrandTotal || 0})
                    </td>
                </tr>
            `;

            const itemRows = row.invoices.map(inv => {
                return `<tr>${headers.map(h => {
                    let val = getValue(inv, h);
                    if (typeof val === 'object' && val !== null) val = '';
                    return `<td>${val}</td>`;
                }).join('')}</tr>`;
            }).join('');

            return groupHeader + itemRows;
        }

        // Flat Data
        return `<tr>${headers.map(h => {
            let val = getValue(row, h);
            if (typeof val === 'object' && val !== null) val = ''; // Avoid [object Object]
            return `<td>${val}</td>`;
        }).join('')}</tr>`;
    }).join('');
};

const generateSummaryHtml = (summary) => {
    if (!summary) return '';
    return `
        <div class="summary">
            <h3>Summary</h3>
            <table style="width: auto;">
                <tr>
                    <th>Total Invoices</th>
                    <th>Taxable Value</th>
                    <th>Grand Total</th>
                    ${summary.productsTotal ? '<th>Products Total</th>' : ''}
                </tr>
                <tr style="font-weight: bold; background-color: #e8e8e8;">
                    <td>${summary.totalInvoices || 0}</td>
                    <td>${summary.taxableValueTotal || '0.00'}</td>
                    <td>${summary.grandTotal || '0.00'}</td>
                    ${summary.productsTotal ? `<td>${summary.productsTotal}</td>` : ''}
                </tr>
            </table>
        </div>
    `;
};

const generateSalesReportPdf = async (data, filters, user = {}) => {
    const html = generateSalesReportHtml(data, filters, user);
    // Use wider layout for PDF
    return await convertHtmlToPdf(html, {
        format: 'A4',
        landscape: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        width: 1200 // Force width to safely fit columns
    });
};

const generateSalesReportExcel = async (data, filters) => {
    const { reports, summary } = data;
    const { selectedColumns = [] } = filters;
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Determine headers
    let headers = [];
    if (selectedColumns.length > 0) {
        headers = selectedColumns;
    } else if (reports.length > 0) {
        if (reports[0].invoices && Array.isArray(reports[0].invoices)) {
            if (reports[0].invoices.length > 0) headers = getLeafPaths(reports[0].invoices[0]);
            else headers = getLeafPaths(reports[0]).filter(k => k !== 'invoices' && k !== 'data');
        } else {
            headers = getLeafPaths(reports[0]).filter(k => k !== '_id' && k !== 'id');
        }
    }

    // Styles
    const boldFont = { bold: true };
    const centerAlign = { horizontal: 'center' };
    const titleFont = { size: 14, bold: true };

    // Row 1: Title
    worksheet.mergeCells('A1', 'E1');
    const titleRow = worksheet.getRow(1);
    titleRow.getCell(1).value = 'Sales Report';
    titleRow.getCell(1).font = titleFont;
    titleRow.getCell(1).alignment = centerAlign;

    // Row 2: Date
    worksheet.mergeCells('A2', 'E2');
    const dateRow = worksheet.getRow(2);
    const dateRangeStr = filters.dateRange
        ? `${new Date(filters.dateRange.from).toLocaleDateString()} - ${new Date(filters.dateRange.to).toLocaleDateString()}`
        : 'All Dates';
    dateRow.getCell(1).value = `Date Range: ${dateRangeStr}`;
    dateRow.getCell(1).alignment = centerAlign;

    // Row 4: Columns
    const headerRow = worksheet.getRow(4);
    headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = formatHeader(h);
        cell.font = boldFont;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
        worksheet.getColumn(i + 1).width = 20;
    });

    // Rows
    reports.forEach(row => {
        // Grouped
        if (row.invoices && Array.isArray(row.invoices)) {
            // Group Header
            let groupId = '';
            if (row._id) groupId = typeof row._id === 'object' ? JSON.stringify(row._id) : row._id;
            else groupId = 'Group';

            const grpRow = worksheet.addRow([`${groupId} (Total: ${row.totalInvoices})`]);
            grpRow.font = { bold: true, color: { argb: 'FF555555' } };

            // Invoices
            row.invoices.forEach(inv => {
                const rowData = headers.map(h => {
                    let val = getValue(inv, h);
                    if (typeof val === 'object') return '';
                    return val;
                });
                worksheet.addRow(rowData);
            });
        } else {
            // Flat
            const rowData = headers.map(h => {
                let val = getValue(row, h);
                if (typeof val === 'object') return '';
                return val;
            });
            worksheet.addRow(rowData);
        }
    });

    // Summary
    if (summary) {
        worksheet.addRow([]);
        const sumHead = worksheet.addRow(['Summary', '', '', '']);
        sumHead.font = boldFont;

        const sumTitle = worksheet.addRow(['Total Invoices', 'Taxable Value', 'Grand Total', summary.productsTotal ? 'Products Total' : '']);
        sumTitle.font = boldFont;

        const sumVal = worksheet.addRow([
            summary.totalInvoices,
            summary.taxableValueTotal,
            summary.grandTotal,
            summary.productsTotal || ''
        ]);
        sumVal.font = boldFont;
    }

    return await workbook.xlsx.writeBuffer();
};

module.exports = {
    generateSalesReportHtml,
    generateSalesReportPdf,
    generateSalesReportExcel
};
