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
    // Prevent negative zero (-0.00)
    if (num === 0 || Math.abs(num) < 0.005) num = 0;
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

// Exact Layout Structure
const generateGSTR3BHtml = ({ data, reportTitle, companyInfo, filters }) => {
    const gstrData = data[0];
    const companyName = companyInfo?.companyDetails?.legalName || companyInfo?.companyName || 'N/A';
    const gstin = companyInfo?.companyDetails?.gstin || companyInfo?.gstin || 'N/A';

    let dateRangeStr = '';
    if (filters?.fromDate && filters?.toDate) {
        dateRangeStr = `${formatDate(filters.fromDate)} to ${formatDate(filters.toDate)}`;
    }

    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${reportTitle}</title>
<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; margin: 0; padding: 20px; }
    .gstr-container { border: 1px solid #000; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th, td { border: 1px solid #000; padding: 3px 5px; text-align: right; }
    th { text-align: center; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    
    .header-table th { background-color: #BDD7EE; }
    .header-table td { background-color: #FFF2CC; text-align: center; }
    .header-table .white-bg { background-color: white; }

    /* Section Colors */
    .sec3-1 th { background-color: #F8CBAD; }
    .sec3-1-headers th { background-color: #ED7D31; color: white; }
    .sec3-1 td { background-color: #F8CBAD; }
    .sec3-1 .blank-cell { background-color: #C65911; }

    .sec4 th { border-color: #000; }
    .sec4-title { background-color: #BDD7EE; }
    .sec4-headers th { background-color: #2F5597; color: white; }
    .sec4 td { background-color: #DDEBF7; }
    .sec4 .blank-cell { background-color: #1F4E78; }
    
    .sec5-title th { background-color: #FFE699; }
    .sec5-headers th { background-color: #FFC000; }
    .sec5 td { background-color: #FFF2CC; }
    
    .sec5-1-title th { background-color: #E4DFEC; }
    .sec5-1-headers th { background-color: #7030A0; color: white; }
    
    .sec3-2-headers th { background-color: #70AD47; color: white; }
    .sec3-2 td { background-color: #E2EFDA; }
</style>
</head>
<body>
<div class="gstr-container">
    <!-- Top Info Blocks -->
    <table class="header-table">
        <tr>
            <th width="15%">GSTIN</th>
            <td width="35%" class="white-bg text-left">${gstin}</td>
            <th width="10%">Year</th>
            <td width="20%">${dateRangeStr}</td>
            <th width="10%">Sheet Status:</th>
            <td width="10%"></td>
        </tr>
        <tr>
            <th>Legal name of the registered person</th>
            <td class="white-bg text-left">${companyName}</td>
            <th>Month</th>
            <td></td>
            <th style="background:none; border:none;"></th>
            <td style="background:none; border:none;"></td>
        </tr>
    </table>

    <!-- 3.1 -->
    <table class="sec3-1">
        <tr class="sec3-1-headers"><th colspan="6">3.1 Details of Outward Supplies and inward supplies liable to reverse charge</th></tr>
        <tr class="sec3-1-headers">
            <th width="40%">Nature of Supplies</th>
            <th width="12%">Total Taxable value</th>
            <th width="12%">Integrated Tax</th>
            <th width="12%">Central Tax</th>
            <th width="12%">State/UT Tax</th>
            <th width="12%">Cess</th>
        </tr>
        <tr class="sec3-1-headers">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th>
        </tr>
        <tr>
            <td class="text-left">(a) Outward Taxable supplies (other than zero rated, nil rated and exempted)</td>
            <td>${formatNumber(gstrData.section3_1[0].taxable)}</td>
            <td>${formatNumber(gstrData.section3_1[0].igst)}</td>
            <td>${formatNumber(gstrData.section3_1[0].cgst)}</td>
            <td>${formatNumber(gstrData.section3_1[0].sgst)}</td>
            <td>${formatNumber(gstrData.section3_1[0].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(b) Outward Taxable supplies (zero rated)</td>
            <td>${formatNumber(gstrData.section3_1[1].taxable)}</td>
            <td>${formatNumber(gstrData.section3_1[1].igst)}</td>
            <td class="blank-cell"></td><td class="blank-cell"></td>
            <td>${formatNumber(gstrData.section3_1[1].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(c) Other Outward Taxable supplies (Nil rated, exempted)</td>
            <td>${formatNumber(gstrData.section3_1[2].taxable)}</td>
            <td class="blank-cell"></td><td class="blank-cell"></td><td class="blank-cell"></td><td class="blank-cell"></td>
        </tr>
        <tr>
            <td class="text-left">(d) Inward supplies (liable to reverse charge)</td>
            <td>${formatNumber(gstrData.section3_1[3].taxable)}</td>
            <td>${formatNumber(gstrData.section3_1[3].igst)}</td>
            <td>${formatNumber(gstrData.section3_1[3].cgst)}</td>
            <td>${formatNumber(gstrData.section3_1[3].sgst)}</td>
            <td>${formatNumber(gstrData.section3_1[3].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(e) Non-GST Outward supplies</td>
            <td>${formatNumber(gstrData.section3_1[4].taxable)}</td>
            <td class="blank-cell"></td><td class="blank-cell"></td><td class="blank-cell"></td><td class="blank-cell"></td>
        </tr>
        <tr>
            <th class="text-center">Total</th>
            <td>${formatNumber(gstrData.section3_1[5].taxable)}</td>
            <td>${formatNumber(gstrData.section3_1[5].igst)}</td>
            <td>${formatNumber(gstrData.section3_1[5].cgst)}</td>
            <td>${formatNumber(gstrData.section3_1[5].sgst)}</td>
            <td>${formatNumber(gstrData.section3_1[5].cess)}</td>
        </tr>
    </table>

    <!-- 4. ITC -->
    <table class="sec4">
        <tr class="sec4-title"><th colspan="5">4. Eligible ITC</th></tr>
        <tr class="sec4-headers">
            <th width="40%">Details</th>
            <th width="15%">Integrated Tax</th>
            <th width="15%">Central Tax</th>
            <th width="15%">State/UT Tax</th>
            <th width="15%">Cess</th>
        </tr>
        <tr class="sec4-headers">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
        </tr>
        <tr><th class="text-left" colspan="5">(A) ITC Available (Whether in full or part)</th></tr>
        <tr>
            <td class="text-left">(1) Import of goods</td>
            <td>${formatNumber(gstrData.section4.A[0].igst)}</td>
            <td class="blank-cell"></td><td class="blank-cell"></td>
            <td>${formatNumber(gstrData.section4.A[0].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(2) Import of services</td>
            <td>${formatNumber(gstrData.section4.A[1].igst)}</td>
            <td class="blank-cell"></td><td class="blank-cell"></td>
            <td>${formatNumber(gstrData.section4.A[1].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(3) Inward supplies liable to reverse charge</td>
            <td>${formatNumber(gstrData.section4.A[2].igst)}</td>
            <td>${formatNumber(gstrData.section4.A[2].cgst)}</td>
            <td>${formatNumber(gstrData.section4.A[2].sgst)}</td>
            <td>${formatNumber(gstrData.section4.A[2].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(4) Inward supplies from ISD</td>
            <td>${formatNumber(gstrData.section4.A[3].igst)}</td>
            <td>${formatNumber(gstrData.section4.A[3].cgst)}</td>
            <td>${formatNumber(gstrData.section4.A[3].sgst)}</td>
            <td>${formatNumber(gstrData.section4.A[3].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(5) All other ITC</td>
            <td>${formatNumber(gstrData.section4.A[4].igst)}</td>
            <td>${formatNumber(gstrData.section4.A[4].cgst)}</td>
            <td>${formatNumber(gstrData.section4.A[4].sgst)}</td>
            <td>${formatNumber(gstrData.section4.A[4].cess)}</td>
        </tr>
        <tr><th class="text-left" colspan="5">(B) ITC Reversed</th></tr>
        <tr>
            <td class="text-left">(1) As per Rule 42 & 43 of SGST/CGST rules</td>
            <td>${formatNumber(gstrData.section4.B[0].igst)}</td>
            <td>${formatNumber(gstrData.section4.B[0].cgst)}</td>
            <td>${formatNumber(gstrData.section4.B[0].sgst)}</td>
            <td>${formatNumber(gstrData.section4.B[0].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(2) Others</td>
            <td>${formatNumber(gstrData.section4.B[1].igst)}</td>
            <td>${formatNumber(gstrData.section4.B[1].cgst)}</td>
            <td>${formatNumber(gstrData.section4.B[1].sgst)}</td>
            <td>${formatNumber(gstrData.section4.B[1].cess)}</td>
        </tr>
        <tr>
            <th class="text-left">(C) Net ITC Available (A)-(B)</th>
            <th>${formatNumber(gstrData.section4.C[0].igst)}</th>
            <th>${formatNumber(gstrData.section4.C[0].cgst)}</th>
            <th>${formatNumber(gstrData.section4.C[0].sgst)}</th>
            <th>${formatNumber(gstrData.section4.C[0].cess)}</th>
        </tr>
        <tr><th class="text-left" colspan="5">(D) Ineligible ITC</th></tr>
        <tr>
            <td class="text-left">(1) As per section 17(5) of CGST/SGST Act</td>
            <td>${formatNumber(gstrData.section4.D[0].igst)}</td>
            <td>${formatNumber(gstrData.section4.D[0].cgst)}</td>
            <td>${formatNumber(gstrData.section4.D[0].sgst)}</td>
            <td>${formatNumber(gstrData.section4.D[0].cess)}</td>
        </tr>
        <tr>
            <td class="text-left">(2) Others</td>
            <td>${formatNumber(gstrData.section4.D[1].igst)}</td>
            <td>${formatNumber(gstrData.section4.D[1].cgst)}</td>
            <td>${formatNumber(gstrData.section4.D[1].sgst)}</td>
            <td>${formatNumber(gstrData.section4.D[1].cess)}</td>
        </tr>
    </table>

    <!-- 5 -->
    <table class="sec5" style="width:60%">
        <tr class="sec5-title"><th colspan="3">5. Values of exempt, Nil rated and non-GST Inward supplies</th></tr>
        <tr class="sec5-headers">
            <th width="40%">Nature of supplies</th>
            <th width="30%">Inter-State supplies</th>
            <th width="30%">Intra-state supplies</th>
        </tr>
        <tr class="sec5-headers">
            <th>1</th><th>2</th><th>3</th>
        </tr>
        <tr>
            <td class="text-left">From a supplier under composition scheme, Exempt and Nil rated supply</td>
            <td>${formatNumber(gstrData.section5[0].interState)}</td>
            <td>${formatNumber(gstrData.section5[0].intraState)}</td>
        </tr>
        <tr>
            <td class="text-left">Non GST supply</td>
            <td>${formatNumber(gstrData.section5[1].interState)}</td>
            <td>${formatNumber(gstrData.section5[1].intraState)}</td>
        </tr>
        <tr>
            <th class="text-center">Total</th>
            <td>${formatNumber(gstrData.section5[2].interState)}</td>
            <td>${formatNumber(gstrData.section5[2].intraState)}</td>
        </tr>
    </table>

    <!-- 5.1 -->
    <table class="sec5" style="width:70%">
        <tr class="sec5-1-title"><th colspan="5">5.1 Interest & late fee payable</th></tr>
        <tr class="sec5-1-headers">
            <th width="40%">Description</th>
            <th width="15%">Integrated Tax</th>
            <th width="15%">Central Tax</th>
            <th width="15%">State/UT Tax</th>
            <th width="15%">Cess</th>
        </tr>
        <tr class="sec5-1-headers">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th>
        </tr>
        <tr>
            <td class="text-left">Interest</td>
            <td>${formatNumber(gstrData.section5_1[0].igst)}</td>
            <td>${formatNumber(gstrData.section5_1[0].cgst)}</td>
            <td>${formatNumber(gstrData.section5_1[0].sgst)}</td>
            <td>${formatNumber(gstrData.section5_1[0].cess)}</td>
        </tr>
    </table>

    <!-- 3.2 -->
    <table class="sec3-2">
        <tr><th colspan="7" class="text-left">3.2 Of the supplies shown in 3.1 (a), details of inter-state supplies made to unregistered persons, composition taxable person and UIN holders</th></tr>
        <tr class="sec3-2-headers">
            <th rowspan="2" width="25%">Place of Supply(State/UT)</th>
            <th colspan="2">Supplies made to Unregistered Persons</th>
            <th colspan="2">Supplies made to Composition Taxable Persons</th>
            <th colspan="2">Supplies made to UIN holders</th>
        </tr>
        <tr class="sec3-2-headers">
            <th>Total Taxable value</th><th>Amount of Integrated Tax</th>
            <th>Total Taxable value</th><th>Amount of Integrated Tax</th>
            <th>Total Taxable value</th><th>Amount of Integrated Tax</th>
        </tr>
        <tr class="sec3-2-headers">
            <th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th>
        </tr>
        ${gstrData.section3_2.map((r, i) => {
        const isTotal = i === gstrData.section3_2.length - 1;
        return `
            <tr>
                <td class="${isTotal ? 'text-center' : 'text-left'}" ${isTotal ? 'style="font-weight:bold"' : ''}>${r.pos || 'Total'}</td>
                <td>${formatNumber(r.unregTaxable)}</td>
                <td>${formatNumber(r.unregIgst)}</td>
                <td>${formatNumber(r.compTaxable)}</td>
                <td>${formatNumber(r.compIgst)}</td>
                <td>${formatNumber(r.uinTaxable)}</td>
                <td>${formatNumber(r.uinIgst)}</td>
            </tr>`;
    }).join('')}
    </table>
</div>
</body>
</html>`;
};


const generateReportHtml = (params) => {
    const { data, columns, reportTitle, filters, companyInfo, summary } = params;

    if (data && data[0] && data[0].gstr3bMode) {
        return generateGSTR3BHtml(params);
    }

    // Determine basic formatting properties
    let dateRangeStr = '';
    if (filters?.fromDate && filters?.toDate) {
        dateRangeStr = `(From Date ${formatDate(filters.fromDate)} To Date ${formatDate(filters.toDate)})`;
    }

    const companyName = companyInfo?.companyDetails?.legalName || companyInfo?.companyName || '';
    const address = companyInfo?.companyDetails?.address || companyInfo?.address || '';
    const city = companyInfo?.companyDetails?.city || companyInfo?.city || '';

    // Headers
    const getAlignClass = (col) => {
        if (col.field === 'stock' || col.field === 'numericStock') return 'text-center';
        if (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) return 'text-right';
        return 'text-left';
    };

    const headersHtml = columns.map(col => {
        return `<th class="${getAlignClass(col)}">${col.label}</th>`;
    }).join('');

    // Rows
    const rowsHtml = data.map(row => {
        const cells = columns.map(col => {
            let val = getValue(row, col.field);
            let className = getAlignClass(col);

            if (col.field.toLowerCase().includes('date')) {
                val = formatDate(val);
            } else if (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) {
                val = formatNumber(val);
                // Special formatting for stock
                if (col.field === 'stock' || col.field === 'numericStock') {
                    className += ' text-teal';
                    const unit = row.unit ? row.unit : '';
                    val = `${val}${unit}`;
                }
            } else if (val === undefined || val === null) {
                val = '';
            }

            return `<td class="${className}">${val}</td>`;
        }).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    // Summary Footer
    let summaryHtml = '';
    if (summary && Object.keys(summary).length > 0) {
        const summaryCells = columns.map((col, idx) => {
            if (idx === 0) return `<td><strong>Total</strong></td>`;

            let alignClass = getAlignClass(col);
            let val = '';
            let className = alignClass;

            // Map summary dynamically based on field type
            if (col.field === 'stock' || col.field === 'numericStock') {
                if (summary.totalStockQty !== undefined) val = formatNumber(summary.totalStockQty);
            } else if (col.field === 'sellValue' || col.field === 'totalSellValue') {
                if (summary.totalSellValue !== undefined) val = formatNumber(summary.totalSellValue);
            } else if (col.field === 'purchaseValue' || col.field === 'totalPurchaseValue') {
                if (summary.totalPurchaseValue !== undefined) val = formatNumber(summary.totalPurchaseValue);
            } else if (col.field === 'grandTotal' || col.field === 'totals.grandTotal') {
                if (summary.grandTotal !== undefined) val = formatNumber(summary.grandTotal);
            } else if (col.field === 'taxableValue' || col.field === 'totals.totalTaxable') {
                if (summary.taxableValueTotal !== undefined) val = formatNumber(summary.taxableValueTotal);
            } else if (col.field === 'expenseAmount') {
                if (summary.totalExpenseAmount !== undefined) val = formatNumber(summary.totalExpenseAmount);
            } else if (col.field === 'otherIncomeAmount') {
                if (summary.totalOtherIncomeAmount !== undefined) val = formatNumber(summary.totalOtherIncomeAmount);
            }

            return `<td class="${className}"><strong>${val}</strong></td>`;
        }).join('');

        summaryHtml = `
        <tfoot>
            <tr class="summary-row">
                ${summaryCells}
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
    .page-container { border: 1px solid #eee; border-radius: 8px; padding: 20px; box-shadow: 0 0 10px rgba(0,0,0,0.05); }
    .header-container { margin-bottom: 30px; }
    .company-section { text-align: left; margin-bottom: 25px; }
    .title-section { text-align: center; }
    
    h3 { margin: 0; font-size: 16px; font-weight: normal; }
    h2 { margin: 0; font-size: 18px; font-weight: bold; }
    p { margin: 2px 0; color: #555; }
    
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    th { border-bottom: 1px solid #ccc; border-top: 1px solid #ccc; padding: 10px 8px; font-weight: normal; color: #555; text-align: left; }
    td { border-bottom: 1px solid #eee; padding: 12px 8px; vertical-align: top; }
    
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .text-center { text-align: center; }
    .text-teal { color: #20b2aa; }
    
    .summary-row td { border-top: 2px solid #555; border-bottom: 1px solid #333; padding: 12px 8px; font-weight: bold; background-color: #fff; }
    
    @media print {
        body { padding: 0; }
        .page-container { border: none; box-shadow: none; padding: 0; }
        .no-print { display: none; }
    }
</style>
</head>
<body>
<div class="page-container">
    <div class="header-container">
        <div class="company-section">
            <h3>${companyName || ''}</h3>
            ${address ? `<p>${address}</p>` : ''}
            ${city ? `<p>${city}</p>` : ''}
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
</div>
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

// --- Excel Generation Helpers ---

const renderExcelRow = (worksheet, currentRowIdx, row, columns, qTotals) => {
    const currentRow = worksheet.getRow(currentRowIdx);
    columns.forEach((col, i) => {
        let val = getValue(row, col.field);
        const cell = currentRow.getCell(i + 1);

        let align = (col.field === 'stock' || col.field === 'numericStock') ? 'center' : (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) ? 'right' : 'left';
        cell.alignment = { horizontal: align };

        if (col.field.toLowerCase().includes('date')) {
            if (val) {
                const d = new Date(val);
                if (!isNaN(d.getTime())) {
                    cell.value = d;
                    cell.numFmt = 'dd-mmm-yyyy';
                } else cell.value = val;
            }
        } else if (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) {
            cell.value = val ? Number(val) : 0;
            cell.numFmt = '#,##0.00';
        } else cell.value = val !== undefined && val !== null ? val : '';
    });
};

const addGroupSubtotal = (worksheet, currentRowIdx, columns, qTotals) => {
    const cell = worksheet.getCell(currentRowIdx, 1);
    cell.value = `Subtotal`;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'right' };

    columns.forEach((col, i) => {
        if (i === 0) return;
        const cell = worksheet.getCell(currentRowIdx, i + 1);
        let align = (col.field === 'stock' || col.field === 'numericStock') ? 'center' : (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) ? 'right' : 'left';
        cell.alignment = { horizontal: align };

        if (qTotals[col.field] !== undefined) {
            cell.value = qTotals[col.field];
            cell.numFmt = '#,##0.00';
        }
    });
};

const itemsHaveDates = (data, columns) => {
    if (!data || data.length === 0) return false;
    const dateFieldObj = columns.find(c => c.field.toLowerCase().includes('date') || c.field.toLowerCase() === 'invoicedate');
    if (!dateFieldObj) return false;
    return getValue(data[0], dateFieldObj.field) !== undefined;
};

const getQuarterLabel = (date) => {
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();

    // Financial Year Q1 = Apr, May, Jun
    if (month >= 4 && month <= 6) return `Q1 (Apr-Jun ${year})`;
    if (month >= 7 && month <= 9) return `Q2 (Jul-Sep ${year})`;
    if (month >= 10 && month <= 12) return `Q3 (Oct-Dec ${year})`;
    return `Q4 (Jan-Mar ${year})`; // Jan, Feb, Mar
};

const groupDataByQuarter = (data, columns) => {
    const dateFieldObj = columns.find(c => c.field.toLowerCase().includes('date') || c.field.toLowerCase() === 'invoicedate');
    const grouped = {};

    data.forEach(item => {
        let val = getValue(item, dateFieldObj.field);
        if (val) {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                const qLabel = getQuarterLabel(d);
                if (!grouped[qLabel]) grouped[qLabel] = [];
                grouped[qLabel].push(item);
                return;
            }
        }
        // Fallback for missing/bad dates
        if (!grouped['Unknown Date']) grouped['Unknown Date'] = [];
        grouped['Unknown Date'].push(item);
    });
    return grouped;
};

const generateGSTR3BExcel = async ({ data, filters, companyInfo }) => {
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('GSTR-3B');
    const gstrData = data[0]; // The aggregated sections

    // Standard column widths
    worksheet.getColumn(1).width = 45; // Description
    worksheet.getColumn(2).width = 15; // Taxable
    worksheet.getColumn(3).width = 15; // IGST
    worksheet.getColumn(4).width = 15; // CGST
    worksheet.getColumn(5).width = 15; // SGST
    worksheet.getColumn(6).width = 15; // Cess
    worksheet.getColumn(7).width = 15; // Extra for 3.2

    // Determine basic formatting properties
    let dateRangeStr = '';
    if (filters?.fromDate && filters?.toDate) {
        dateRangeStr = `${formatDate(filters.fromDate)} to ${formatDate(filters.toDate)}`;
    }

    const companyName = companyInfo?.companyDetails?.legalName || companyInfo?.companyName || 'N/A';
    const gstin = companyInfo?.companyDetails?.gstin || companyInfo?.gstin || 'N/A';

    let rowIdx = 1;

    // --- TOP HEADER BLOCK ---
    const topHeaderData = [
        // Row 1
        [
            { value: 'GSTIN', colStart: 1, colEnd: 1, bold: true, align: 'center', bg: 'FFBDD7EE' }, // Light Blue
            { value: gstin, colStart: 2, colEnd: 3, bold: false, align: 'left', bg: 'FFFFFFFF' }, // White
            { value: 'Year', colStart: 4, colEnd: 4, bold: true, align: 'center', bg: 'FFBDD7EE' }, // Light Blue
            { value: dateRangeStr, colStart: 5, colEnd: 5, bold: false, align: 'center', bg: 'FFFFFFFF' }, // White
            { value: 'Sheet Status:', colStart: 6, colEnd: 6, bold: true, align: 'center', bg: 'FFFFF2CC' }, // Light Yellow
            { value: '', colStart: 7, colEnd: 7, bold: false, align: 'center', bg: 'FFFFFFFF' } // Empty white
        ],
        // Row 2
        [
            { value: 'Legal name of the registered person', colStart: 1, colEnd: 1, bold: true, align: 'center', bg: 'FFFFF2CC' }, // Light Yellow
            { value: companyName, colStart: 2, colEnd: 3, bold: false, align: 'left', bg: 'FFFFFFFF' }, // White
            { value: 'Month', colStart: 4, colEnd: 4, bold: true, align: 'center', bg: 'FFBDD7EE' }, // Light Blue
            { value: '', colStart: 5, colEnd: 5, bold: false, align: 'center', bg: 'FFFFFFFF' }, // White
            { value: '', colStart: 6, colEnd: 6, bold: false, align: 'center', bg: 'FFFFFFFF' }, // Empty
            { value: '', colStart: 7, colEnd: 7, bold: false, align: 'center', bg: 'FFFFFFFF' } // Empty
        ],
        // Row 3 (Spacer)
        []
    ];

    topHeaderData.forEach(rowData => {
        if (rowData.length === 0) {
            rowIdx++; // Spacer row
            return;
        }
        const row = worksheet.getRow(rowIdx);
        rowData.forEach(cellObj => {
            worksheet.mergeCells(rowIdx, cellObj.colStart, rowIdx, cellObj.colEnd);
            const cell = row.getCell(cellObj.colStart);
            cell.value = cellObj.value;
            cell.font = { name: 'Arial', size: 10, bold: cellObj.bold };
            cell.alignment = { horizontal: cellObj.align, vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            if (cellObj.bg && cellObj.bg !== 'FFFFFFFF') { // Don't explicitly paint pure white usually
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellObj.bg } };
            }
        });
        rowIdx++;
    });

    // Add spacer
    rowIdx++;

    // Helper function to append specific styled rows for sections
    const addSectionHeader = (title, columns, titleBgColor, headerBgColor) => {
        // Main title row
        worksheet.mergeCells(rowIdx, 1, rowIdx, columns.length);
        const titleCell = worksheet.getCell(rowIdx, 1);
        titleCell.value = title;
        titleCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: titleBgColor === 'FFBDD7EE' || titleBgColor === 'FFE4DFEC' ? 'FF000000' : 'FFFFFFFF' } }; // Adjust text color for contrast
        titleCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        titleCell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: titleBgColor } };
        rowIdx++;

        // Columns headers row
        const headerRow = worksheet.getRow(rowIdx);
        columns.forEach((colStr, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = colStr;
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: headerBgColor === 'FFED7D31' || headerBgColor === 'FF2F5597' || headerBgColor === 'FF7030A0' || headerBgColor === 'FF70AD47' ? 'FFFFFFFF' : 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
        });
        rowIdx++;

        // Numbers row (1, 2, 3...)
        const numRow = worksheet.getRow(rowIdx);
        columns.forEach((_, i) => {
            const cell = numRow.getCell(i + 1);
            cell.value = i + 1;
            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: headerBgColor === 'FFED7D31' || headerBgColor === 'FF2F5597' || headerBgColor === 'FF7030A0' || headerBgColor === 'FF70AD47' ? 'FFFFFFFF' : 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
        });
        rowIdx++;
    };

    const addDataRow = (dataObj, keys, isTotalRow = false, dataBgColor = null, darkCells = []) => {
        const row = worksheet.getRow(rowIdx);
        keys.forEach((key, i) => {
            const cell = row.getCell(i + 1);
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            cell.font = { name: 'Arial', size: 9, bold: isTotalRow };

            // Set value and alignment
            if (i === 0) {
                cell.value = dataObj[key];
                cell.alignment = { horizontal: isTotalRow ? 'center' : 'left', vertical: 'middle', wrapText: true };
            } else {
                cell.value = Number(dataObj[key]) || 0;
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }

            // Format background
            if (darkCells.includes(key)) {
                // "Blank/Dark" cells representing N/A fields in GSTR3B (e.g. IGST for Exempt)
                let argb;
                if (dataBgColor === 'FFF8CBAD') argb = 'FFC65911'; // Dark Orange for 3.1
                else if (dataBgColor === 'FFDDEBF7') argb = 'FF1F4E78'; // Dark Blue for 4
                else argb = 'FF808080'; // Fallback grey
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
                cell.value = ''; // Enforce blank
            } else if (dataBgColor) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: dataBgColor } };
            }
        });
        rowIdx++;
    };

    // --- SECTION 3.1 ---
    // Colors: Orange Palette
    const titleBg3_1 = 'FFF8CBAD'; // Very light orange for top row (Wait, image looks different. Let's use darker for main title)
    // Adjusting colors to match image closely: 
    // 3.1 Title: Light Orange F8CBAD (but with thin black text)
    // 3.1 Headers: Darker Orange ED7D31 (white text)
    // 3.1 Data: Light Orange F8CBAD

    addSectionHeader('3.1 Details of Outward Supplies and inward supplies liable to reverse charge',
        ['Nature of Supplies', 'Total Taxable value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'],
        'FFF8CBAD', 'FFED7D31');

    const sec3_1DataKeys = ['desc', 'taxable', 'igst', 'cgst', 'sgst', 'cess'];
    addDataRow(gstrData.section3_1[0], sec3_1DataKeys, false, 'FFF8CBAD');
    addDataRow(gstrData.section3_1[1], sec3_1DataKeys, false, 'FFF8CBAD', ['cgst', 'sgst']); // No CGST/SGST for Zero Rated
    addDataRow(gstrData.section3_1[2], sec3_1DataKeys, false, 'FFF8CBAD', ['igst', 'cgst', 'sgst', 'cess']); // Only Taxable for Exempt
    addDataRow(gstrData.section3_1[3], sec3_1DataKeys, false, 'FFF8CBAD');
    addDataRow(gstrData.section3_1[4], sec3_1DataKeys, false, 'FFF8CBAD', ['igst', 'cgst', 'sgst', 'cess']); // Only Taxable for Non-GST
    addDataRow(gstrData.section3_1[5], sec3_1DataKeys, true, 'FFF8CBAD'); // Total row

    rowIdx++; // Spacer

    // --- SECTION 4 ---
    // Colors: Blue Palette
    // 4 Title: White/Light Blue BDD7EE (black text)
    // 4 Headers: Dark Blue 2F5597 (white text)
    // 4 Data: Very Light Blue DDEBF7

    worksheet.mergeCells(rowIdx, 1, rowIdx, 5);
    const titleCell4 = worksheet.getCell(rowIdx, 1);
    titleCell4.value = '4. Eligible ITC';
    titleCell4.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF000000' } };
    titleCell4.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    titleCell4.border = { top: { style: 'medium', color: { argb: 'FF000000' } }, left: { style: 'medium', color: { argb: 'FF000000' } }, bottom: { style: 'thin' }, right: { style: 'medium', color: { argb: 'FF000000' } } };
    titleCell4.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Looks white with thick border in image
    rowIdx++;

    const headerRow4 = worksheet.getRow(rowIdx);
    ['Details', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'].forEach((colStr, i) => {
        const cell = headerRow4.getCell(i + 1);
        cell.value = colStr;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    });
    rowIdx++;
    const numRow4 = worksheet.getRow(rowIdx);
    for (let i = 1; i <= 5; i++) {
        const cell = numRow4.getCell(i);
        cell.value = i;
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F5597' } };
    }
    rowIdx++;

    const sec4DataKeys = ['desc', 'igst', 'cgst', 'sgst', 'cess'];

    // (A) Available
    const subHeadA = worksheet.getRow(rowIdx);
    worksheet.mergeCells(rowIdx, 1, rowIdx, 5);
    subHeadA.getCell(1).value = '(A) ITC Available (Whether in full or part)';
    subHeadA.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    subHeadA.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    rowIdx++;

    addDataRow(gstrData.section4.A[0], sec4DataKeys, false, 'FFDDEBF7', ['cgst', 'sgst']); // Import Goods
    addDataRow(gstrData.section4.A[1], sec4DataKeys, false, 'FFDDEBF7', ['cgst', 'sgst']); // Import Service
    addDataRow(gstrData.section4.A[2], sec4DataKeys, false, 'FFDDEBF7'); // Rev Charge
    addDataRow(gstrData.section4.A[3], sec4DataKeys, false, 'FFDDEBF7'); // ISD
    addDataRow(gstrData.section4.A[4], sec4DataKeys, false, 'FFDDEBF7'); // All other

    // (B) Reversed
    const subHeadB = worksheet.getRow(rowIdx);
    worksheet.mergeCells(rowIdx, 1, rowIdx, 5);
    subHeadB.getCell(1).value = '(B) ITC Reversed';
    subHeadB.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    subHeadB.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    rowIdx++;

    addDataRow(gstrData.section4.B[0], sec4DataKeys, false, 'FFDDEBF7'); // Rule 42
    addDataRow(gstrData.section4.B[1], sec4DataKeys, false, 'FFDDEBF7'); // Others

    // (C) Net
    addDataRow(gstrData.section4.C[0], sec4DataKeys, true, 'FFDDEBF7');

    // (D) Ineligible
    const subHeadD = worksheet.getRow(rowIdx);
    worksheet.mergeCells(rowIdx, 1, rowIdx, 5);
    subHeadD.getCell(1).value = '(D) Ineligible ITC';
    subHeadD.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    subHeadD.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    rowIdx++;

    addDataRow(gstrData.section4.D[0], sec4DataKeys, false, 'FFDDEBF7'); // Sec 17(5)
    addDataRow(gstrData.section4.D[1], sec4DataKeys, false, 'FFDDEBF7'); // Others

    rowIdx++; // Spacer

    // --- SECTION 5 ---
    // Colors: Yellow Palette
    // 5 Title: Light Yellow FFE699 (black text)
    // 5 Headers: Darker Yellow FFC000 (black text)
    // 5 Data: Light Yellow FFF2CC
    addSectionHeader('5. Values of exempt, Nil-rated and non-GST inward supplies',
        ['Nature of supplies', 'Inter-State supplies', 'Intra-state supplies'],
        'FFFFE699', 'FFFFC000');

    const sec5DataKeys = ['desc', 'interState', 'intraState'];
    addDataRow(gstrData.section5[0], sec5DataKeys, false, 'FFFFF2CC'); // Composition/Exempt
    addDataRow(gstrData.section5[1], sec5DataKeys, false, 'FFFFF2CC'); // Non-GST
    addDataRow(gstrData.section5[2], sec5DataKeys, true, 'FFFFF2CC'); // Total

    rowIdx++; // Spacer

    // --- SECTION 5.1 ---
    // Colors: Purple Palette
    // 5.1 Title: Light Purple E4DFEC (black text)
    // 5.1 Headers: Dark Purple 7030A0 (white text)
    addSectionHeader('5.1 Interest & late fee payable',
        ['Description', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'],
        'FFE4DFEC', 'FF7030A0');

    const sec51DataKeys = ['desc', 'igst', 'cgst', 'sgst', 'cess'];
    addDataRow(gstrData.section5_1[0], sec51DataKeys, false, 'FFFFFFFF'); // Interest (Default Whiteish)

    rowIdx++; // Spacer

    // --- SECTION 3.2 ---
    // Colors: Green Palette
    // 3.2 Header Group 1: Light Green C6E0B4
    // 3.2 Header Group 2: Dark Green 70AD47 (white text)
    worksheet.mergeCells(rowIdx, 1, rowIdx, 7);
    const titleCell32 = worksheet.getCell(rowIdx, 1);
    titleCell32.value = '3.2 Of the supplies shown in 3.1 (a), details of inter-state supplies made to unregistered persons, composition taxable person and UIN holders';
    titleCell32.font = { name: 'Arial', size: 9, bold: true };
    titleCell32.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    titleCell32.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    rowIdx++;

    const sub32_1 = worksheet.getRow(rowIdx);
    // Place of Supply
    worksheet.mergeCells(rowIdx, 1, rowIdx + 1, 1);
    sub32_1.getCell(1).value = 'Place of Supply(State/UT)';
    sub32_1.getCell(1).font = { name: 'Arial', size: 9, bold: true };
    sub32_1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sub32_1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } }; // Light green
    sub32_1.getCell(1).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells(rowIdx, 2, rowIdx, 3);
    sub32_1.getCell(2).value = 'Supplies made to Unregistered Persons';
    sub32_1.getCell(2).font = { name: 'Arial', size: 9, bold: true };
    sub32_1.getCell(2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sub32_1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
    sub32_1.getCell(2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells(rowIdx, 4, rowIdx, 5);
    sub32_1.getCell(4).value = 'Supplies made to Composition Taxable Persons';
    sub32_1.getCell(4).font = { name: 'Arial', size: 9, bold: true };
    sub32_1.getCell(4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sub32_1.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
    sub32_1.getCell(4).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

    worksheet.mergeCells(rowIdx, 6, rowIdx, 7);
    sub32_1.getCell(6).value = 'Supplies made to UIN holders';
    sub32_1.getCell(6).font = { name: 'Arial', size: 9, bold: true };
    sub32_1.getCell(6).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    sub32_1.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
    sub32_1.getCell(6).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    rowIdx++;

    const sub32_2 = worksheet.getRow(rowIdx);
    // (Cell 1 is merged)
    const subCols32 = ['Total Taxable value', 'Amount of Integrated Tax', 'Total Taxable value', 'Amount of Integrated Tax', 'Total Taxable value', 'Amount of Integrated Tax'];
    for (let i = 0; i < 6; i++) {
        sub32_2.getCell(i + 2).value = subCols32[i];
        sub32_2.getCell(i + 2).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
        sub32_2.getCell(i + 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } }; // Dark green
        sub32_2.getCell(i + 2).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        sub32_2.getCell(i + 2).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    rowIdx++;

    const sub32_3 = worksheet.getRow(rowIdx);
    for (let i = 1; i <= 7; i++) {
        sub32_3.getCell(i).value = i;
        sub32_3.getCell(i).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }; // Assuming dark green for numbering
        if (i > 1) {
            sub32_3.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
        } else {
            sub32_3.getCell(i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
            sub32_3.getCell(i).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF000000' } };
        }
        sub32_3.getCell(i).alignment = { horizontal: 'center', vertical: 'middle' };
        sub32_3.getCell(i).border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    }
    rowIdx++;

    gstrData.section3_2.forEach((r, i) => {
        const isTotal = (i === gstrData.section3_2.length - 1);
        addDataRow(r, ['pos', 'unregTaxable', 'unregIgst', 'compTaxable', 'compIgst', 'uinTaxable', 'uinIgst'], isTotal, 'FFE2EFDA'); // Very light green bg
    });

    return await workbook.xlsx.writeBuffer();
};

// --- Excel Generation ---

const generateReportExcel = async ({ data, columns, reportTitle, filters, companyInfo, summary }) => {
    // Intercept GSTR-3B
    if (data && data[0] && data[0].gstr3bMode === true) {
        return await generateGSTR3BExcel({ data, filters, companyInfo });
    }

    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Report');

    // We do NOT set worksheet.columns = ... upfront
    // because ExcelJS will forcibly write them to Row 1!
    // Instead we will just apply the widths directly.
    columns.forEach((col, i) => {
        worksheet.getColumn(i + 1).width = Math.max(col.label.length + 5, 15);
    });

    // --- Header Section ---
    const companyName = companyInfo?.companyName || '';
    const address = companyInfo?.address || '';
    const city = companyInfo?.city || '';

    let rowIdx = 1;
    // Row 1: Company Name
    if (companyName) {
        worksheet.getCell(`A${rowIdx}`).value = companyName;
        worksheet.getCell(`A${rowIdx}`).font = { name: 'Arial', size: 12, bold: false };
        rowIdx++;
    }

    // Row 2: Title
    worksheet.getCell(`A${rowIdx}`).value = reportTitle;
    worksheet.getCell(`A${rowIdx}`).font = { name: 'Arial', size: 14, bold: true };
    rowIdx++;

    // Row 3: Date Range
    if (filters?.fromDate && filters?.toDate) {
        const dateRangeStr = `(From Date ${formatDate(filters.fromDate)} To Date ${formatDate(filters.toDate)})`;
        worksheet.getCell(`A${rowIdx}`).value = dateRangeStr;
        worksheet.getCell(`A${rowIdx}`).font = { name: 'Arial', size: 10, bold: false };
        rowIdx++;
    }

    // Add an empty spacer row
    rowIdx++;

    // --- Table Section ---
    const tableStartRow = rowIdx;

    // Add Headers row correctly
    const headerRow = worksheet.getRow(tableStartRow);
    columns.forEach((col, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = col.label;
        cell.font = { bold: true };
        cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };

        let align = (col.field === 'stock' || col.field === 'numericStock') ? 'center' : (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) ? 'right' : 'left';
        cell.alignment = { horizontal: align };
    });
    rowIdx++;

    // Add Data Rows
    let qTotals = {};
    let currentQuarter = null;
    let requiresQuarterSubtotals = false;

    if (filters.isQuarterly === true || filters.isQuarterly === 'true') {
        if (itemsHaveDates(data, columns)) {
            requiresQuarterSubtotals = true;
        }
    }

    if (requiresQuarterSubtotals) {
        const groupedData = groupDataByQuarter(data, columns);
        for (const [qLabel, qItems] of Object.entries(groupedData)) {

            // Provide a visually distinct header for the quarter inline
            worksheet.mergeCells(`A${rowIdx}:${String.fromCharCode(64 + columns.length)}${rowIdx}`);
            const qHeadCell = worksheet.getCell(`A${rowIdx}`);
            qHeadCell.value = `Quarter: ${qLabel}`;
            qHeadCell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
            qHeadCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }; // Blue background
            qHeadCell.alignment = { horizontal: 'left', vertical: 'middle' };
            rowIdx++;

            qTotals = {};

            qItems.forEach(row => {
                renderExcelRow(worksheet, rowIdx, row, columns, qTotals);

                // Accumulate subtotals
                columns.forEach((col) => {
                    const val = getValue(row, col.field);
                    if (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) {
                        const num = Number(val) || 0;
                        qTotals[col.field] = (qTotals[col.field] || 0) + num;
                    }
                });

                rowIdx++;
            });

            // Add Subtotal Row
            addGroupSubtotal(worksheet, rowIdx, columns, qTotals);
            rowIdx++;

            // Spacer after subtotal
            rowIdx++;
        }
    } else {
        // Normal export
        data.forEach(row => {
            renderExcelRow(worksheet, rowIdx, row, columns, qTotals);
            rowIdx++;
        });
    }

    // Add Overall Summary/Footer
    if (summary && Object.keys(summary).length > 0) {
        const currentRowIdx = rowIdx;
        const totalRow = worksheet.getRow(currentRowIdx);

        columns.forEach((col, i) => {
            const cell = totalRow.getCell(i + 1);
            cell.border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
            cell.font = { bold: true };

            if (i === 0) {
                cell.value = 'Total';
                return;
            }

            let align = (col.field === 'stock' || col.field === 'numericStock') ? 'center' : (col.type === 'number' || col.field.toLowerCase().includes('value') || col.field.includes('amount')) ? 'right' : 'left';
            cell.alignment = { horizontal: align };

            let val = '';
            if (col.field === 'stock' || col.field === 'numericStock') {
                if (summary.totalStockQty !== undefined) val = summary.totalStockQty;
            } else if (col.field === 'sellValue' || col.field === 'totalSellValue') {
                if (summary.totalSellValue !== undefined) val = summary.totalSellValue;
            } else if (col.field === 'purchaseValue' || col.field === 'totalPurchaseValue') {
                if (summary.totalPurchaseValue !== undefined) val = summary.totalPurchaseValue;
            } else if (col.field === 'grandTotal' || col.field === 'totals.grandTotal') {
                if (summary.grandTotal !== undefined) val = summary.grandTotal;
            } else if (col.field === 'taxableValue' || col.field === 'totals.totalTaxable') {
                if (summary.taxableValueTotal !== undefined) val = summary.taxableValueTotal;
            } else if (col.field === 'expenseAmount') {
                if (summary.totalExpenseAmount !== undefined) val = summary.totalExpenseAmount;
            } else if (col.field === 'otherIncomeAmount') {
                if (summary.totalOtherIncomeAmount !== undefined) val = summary.totalOtherIncomeAmount;
            }

            if (val !== '') {
                cell.value = val;
                if (typeof val === 'number') cell.numFmt = '#,##0.00';
            }
        });
    }

    return await workbook.xlsx.writeBuffer();
};

// --- Email ---

const sendReportEmail = async (params) => {
    const { to, cc, bcc, subject, body, reportTitle, data } = params;

    if (!to) throw new Error('Recipient email is required');

    let attachmentBuffer;
    let attachmentFilename;
    let contentType;

    const sanitizedTitle = reportTitle.replace(/[^a-zA-Z0-9]/g, '_');

    if (data && data.length > 0 && data[0].gstr3bMode === true) {
        // Force Excel for GSTR3B
        attachmentBuffer = await generateGSTR3BExcel(params);
        attachmentFilename = `${sanitizedTitle}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
        attachmentBuffer = await generateReportPdf(params);
        attachmentFilename = `${sanitizedTitle}.pdf`;
        contentType = 'application/pdf';
    }

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

    const mailOptions = {
        from: `"${process.env.FROM_NAME}" <${process.env.FROM_EMAIL}>`,
        to,
        cc,
        bcc,
        subject: subject || `${reportTitle}`,
        html: body || `<p>Please find attached the ${reportTitle}.</p>`,
        attachments: [
            {
                filename: attachmentFilename,
                content: attachmentBuffer,
                contentType: contentType
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
