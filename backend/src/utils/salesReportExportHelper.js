const excel = require('exceljs');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const { generateSalesReportHtml } = require('./salesReportTemplate');

/**
 * Generate PDF for Sales Report
 */
const generateSalesReportPdf = async (data, filters, companyInfo) => {
    const html = generateSalesReportHtml(data, filters, companyInfo);
    return await convertHtmlToPdf(html, {
        format: 'A4',
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        printBackground: true
    });
};

/**
 * Generate Excel for Sales Report
 */
const generateSalesReportExcel = async (data, filters, companyInfo) => {
    const { reports, summary } = data;
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Styling Constants
    const boldFont = { bold: true, name: 'Arial', size: 10 };
    const titleFont = { bold: true, size: 18, name: 'Arial' };
    const headerFont = { bold: true, size: 12, name: 'Arial' };
    const companyFont = { bold: true, size: 14, name: 'Arial' };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const rightAlign = { horizontal: 'right' };
    const borderStyle = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };
    const thickTopBorder = {
        top: { style: 'thick' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // Row 1: Company Name
    const r1 = worksheet.getRow(1);
    r1.getCell(1).value = companyInfo.companyName || '';
    r1.getCell(1).font = companyFont;

    // Row 2: Address
    const r2 = worksheet.getRow(2);
    r2.getCell(1).value = companyInfo.address || '';

    // Row 3: City
    const r3 = worksheet.getRow(3);
    r3.getCell(1).value = companyInfo.city || '';

    // Row 5: Title "Sales Report" (Merged A5:F5)
    worksheet.mergeCells('A5:F5');
    const r5 = worksheet.getRow(5);
    r5.getCell(1).value = 'Sales Report';
    r5.getCell(1).font = titleFont;
    r5.getCell(1).alignment = centerAlign;

    // Row 7: Date Range (Merged A7:F7)
    worksheet.mergeCells('A7:F7');
    const r7 = worksheet.getRow(7);
    const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-') : '';
    const dateRangeStr = filters.dateRange
        ? `${formatDate(filters.dateRange.from)} to ${formatDate(filters.dateRange.to)}`
        : 'All Dates';
    r7.getCell(1).value = dateRangeStr;
    r7.getCell(1).font = headerFont; // User said size 12
    r7.getCell(1).alignment = centerAlign;

    // Row 9: Column Headers
    const headers = ['Vch Type', 'Invoice No', 'Invoice Date', 'Company Name', 'Taxable Value Total', 'Grand Total'];
    const r9 = worksheet.getRow(9);
    headers.forEach((h, i) => {
        const cell = r9.getCell(i + 1);
        cell.value = h;
        cell.font = boldFont;
        cell.alignment = centerAlign;
        cell.border = borderStyle;
    });

    // Data Rows (Start Row 10)
    let flattenedRows = [];
    if (reports.length > 0) {
        if (reports[0].invoices && Array.isArray(reports[0].invoices)) {
            reports.forEach(group => {
                group.invoices.forEach(inv => {
                    const row = { ...inv };
                    if (!row.customerInformation) row.customerInformation = {};
                    if (!row.customerInformation.ms && group.customer) {
                        row.customerInformation.ms = group.customer;
                    }
                    flattenedRows.push(row);
                });
            });
        } else {
            flattenedRows = reports;
        }
    }

    flattenedRows.forEach(row => {
        const vchType = row.invoiceDetails?.invoiceType || 'Sales';
        const invoiceNo = row.invoiceDetails?.invoiceNumber || '';
        // Date type for Excel
        const invoiceDate = row.invoiceDetails?.date ? new Date(row.invoiceDetails.date) : null;
        const customerName = row.customerInformation?.ms || '';
        const taxable = row.totals?.totalTaxable || 0;
        const grandTotal = row.totals?.grandTotal || 0;

        const newRow = worksheet.addRow([vchType, invoiceNo, invoiceDate, customerName, taxable, grandTotal]);

        // Formatting
        newRow.getCell(3).numFmt = 'dd-mmm-yyyy'; // Date format
        newRow.getCell(5).numFmt = '#,##0.00'; // Numeric
        newRow.getCell(6).numFmt = '#,##0.00'; // Numeric
        newRow.getCell(5).alignment = rightAlign;
        newRow.getCell(6).alignment = rightAlign;

        // Borders
        newRow.eachCell((cell) => {
            cell.border = borderStyle;
        });
    });

    // Summary Row
    const totalDocs = summary?.totalInvoices || flattenedRows.length || 0;
    const totalTaxable = summary?.taxableValueTotal || 0;
    const totalGrand = summary?.grandTotal || 0;

    const summaryRow = worksheet.addRow(['', '', '', `${totalDocs} Documents`, totalTaxable, totalGrand]);

    // Summary Styling
    summaryRow.font = boldFont;
    summaryRow.getCell(4).border = thickTopBorder;
    summaryRow.getCell(5).border = thickTopBorder;
    summaryRow.getCell(6).border = thickTopBorder;
    summaryRow.getCell(5).numFmt = '#,##0.00';
    summaryRow.getCell(6).numFmt = '#,##0.00';
    summaryRow.getCell(5).alignment = rightAlign;
    summaryRow.getCell(6).alignment = rightAlign;

    // View settings
    worksheet.views = [{ showGridLines: false }];

    // Auto width (approximate)
    worksheet.columns = [
        { width: 15 }, // Vch Type
        { width: 15 }, // Invoice No
        { width: 15 }, // Date
        { width: 40 }, // Company Name
        { width: 20 }, // Taxable
        { width: 20 }  // Grand Total
    ];

    return await workbook.xlsx.writeBuffer();
};

module.exports = {
    generateSalesReportPdf,
    generateSalesReportExcel
};
