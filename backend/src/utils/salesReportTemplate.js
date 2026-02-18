/**
 * Generate HTML string for Sales Report
 * matching the "Clean Modern" design requirements.
 */
const generateSalesReportHtml = (data, filters, companyInfo = {}) => {
    const { reports, summary } = data;

    // Date formatting helper (DD-MMM-YYYY)
    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
    };

    // Number formatting helper
    const formatNumber = (num) => {
        if (typeof num !== 'number') return num || '0.00';
        return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Company Details
    const companyName = companyInfo.companyName || '';
    const addressLine = companyInfo.address || '';
    const city = companyInfo.city || '';

    // Date Range
    const dateRangeStr = filters.dateRange
        ? `${formatDate(filters.dateRange.from)} to ${formatDate(filters.dateRange.to)}`
        : 'All Dates';

    // Flatten logic
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

    // Generate Rows
    const rowsHtml = flattenedRows.map(row => {
        const vchType = row.invoiceDetails?.invoiceType || 'Sales';
        const invoiceNo = row.invoiceDetails?.invoiceNumber || '';
        const invoiceDate = formatDate(row.invoiceDetails?.date);
        const customerName = row.customerInformation?.ms || '';

        // Handle totals
        let taxable = '0.00';
        let grandTotal = '0.00';

        if (row.totals) {
            taxable = typeof row.totals.totalTaxable === 'number' ? formatNumber(row.totals.totalTaxable) : (row.totals.totalTaxable || '0.00');
            grandTotal = typeof row.totals.grandTotal === 'number' ? formatNumber(row.totals.grandTotal) : (row.totals.grandTotal || '0.00');
        }

        return `
            <tr>
                <td>${vchType}</td>
                <td>${invoiceNo}</td>
                <td>${invoiceDate}</td>
                <td>${customerName}</td>
                <td class="numeric">${taxable}</td>
                <td class="numeric">${grandTotal}</td>
            </tr>
        `;
    }).join('');

    // Summary Values
    const docCount = summary?.totalInvoices || 0;
    const totalTaxable = typeof summary?.taxableValueTotal === 'number' ? formatNumber(summary.taxableValueTotal) : (summary?.taxableValueTotal || '0.00');
    const totalGrand = typeof summary?.grandTotal === 'number' ? formatNumber(summary.grandTotal) : (summary?.grandTotal || '0.00');

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    font-size: 14px; 
                    color: #333; 
                    margin: 0; 
                    padding: 20px;
                }
                
                /* Company Section */
                .company-section {
                    margin-bottom: 40px;
                }
                .company-name {
                    font-size: 22px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 5px;
                }
                .company-details {
                    font-size: 14px;
                    color: #555;
                    line-height: 1.4;
                }
                
                /* Title Section */
                .report-title {
                    text-align: center;
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #000;
                }
                
                /* Date Range */
                .date-range {
                    text-align: center;
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 40px;
                }

                /* Table Styling */
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 14px;
                }

                th {
                    border-bottom: 2px solid #ccc;
                    padding: 10px;
                    text-align: left;
                    font-weight: bold;
                    color: #444;
                }

                td {
                    border-bottom: 1px solid #eee;
                    padding: 10px;
                    vertical-align: top;
                }

                .numeric {
                    text-align: right;
                }

                /* Summary Row */
                .summary-row td {
                    font-weight: bold;
                    border-top: 3px solid #000;
                    border-bottom: 3px solid #000;
                    padding-top: 15px;
                    padding-bottom: 15px;
                    font-size: 14px;
                }
            </style>
        </head>
        <body>
            <div class="company-section">
                <div class="company-name">${companyName}</div>
                <div class="company-details">
                    ${addressLine}<br/>
                    ${city}
                </div>
            </div>

            <div class="report-title">Sales Report</div>
            
            <div class="date-range">${dateRangeStr}</div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 10%">Vch Type</th>
                        <th style="width: 10%">Invoice No</th>
                        <th style="width: 15%">Invoice Date</th>
                        <th style="width: 35%">Company Name</th>
                        <th class="numeric" style="width: 15%">Taxable Value Total</th>
                        <th class="numeric" style="width: 15%">Grand Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
                <tfoot>
                    <tr class="summary-row">
                        <td colspan="3"></td>
                        <td>${docCount} Documents</td>
                        <td class="numeric">${totalTaxable}</td>
                        <td class="numeric">${totalGrand}</td>
                    </tr>
                </tfoot>
            </table>
        </body>
        </html>
    `;
};

module.exports = { generateSalesReportHtml };
