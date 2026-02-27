const fs = require('fs');
const filepath = 'd:\\Inout_billing\\inoutbilling_backend\\backend\\src\\utils\\reportExportHelper.js';
const content = fs.readFileSync(filepath, 'utf8');
const lines = content.split(/\r?\n/);

let newLines = [];

// 1. Imports and Helpers: Lines 1 to 55
newLines = newLines.concat(lines.slice(0, 55));
newLines.push('');

// 2. generateGSTR3BHtml: Lines 155 to 457. (Decrease indent by 4 spaces)
let gstr3bHtml = lines.slice(154, 457).map(line => line.startsWith('    ') ? line.substring(4) : line);
newLines = newLines.concat(gstr3bHtml);
newLines.push('');

// 3. generateReportHtml: Lines 458 to 613. (Decrease indent by 4 spaces)
let reportHtml = lines.slice(457, 613).map(line => line.startsWith('    ') ? line.substring(4) : line);
newLines = newLines.concat(reportHtml);
newLines.push('');

// 4. generateReportPdf: Lines 1150 to 1166 (Decrease indent by 12 spaces)
let reportPdf = lines.slice(1149, 1166).map(line => line.startsWith('            ') ? line.substring(12) : line);
newLines = newLines.concat(reportPdf);
newLines.push('');

// 5. Excel Helpers: Lines 1168 to 1601 (Decrease indent by 12 spaces)
let excelHelpers = lines.slice(1167, 1601).map(line => line.startsWith('            ') ? line.substring(12) : Math.max(0, line.indexOf(line.trim())) >= 12 && line.trim().length > 0 ? line.substring(12) : line);
// In case some lines don't start with 12 spaces, just check if they have at least 12 spaces of indent and remove them, actually the regex might be better:
// let's use a simpler one: replace exactly 12 leading spaces
excelHelpers = lines.slice(1167, 1601).map(line => line.replace(/^ {12}/, ''));
newLines = newLines.concat(excelHelpers);
newLines.push('');

// Wait, I will just rewrite all maps uniformly:
gstr3bHtml = lines.slice(154, 457).map(line => line.replace(/^ {4}/, ''));
reportHtml = lines.slice(457, 613).map(line => line.replace(/^ {4}/, ''));
reportPdf = lines.slice(1149, 1166).map(line => line.replace(/^ {12}/, ''));
excelHelpers = lines.slice(1167, 1601).map(line => line.replace(/^ {12}/, ''));

// 6. generateReportExcel: Lines 1603 to 1765 (Decrease indent by 12 spaces)
let reportExcel = lines.slice(1602, 1765).map(line => line.replace(/^ {12}/, ''));
newLines = newLines.concat(reportExcel);
newLines.push('');

// 7. sendReportEmail: Lines 1767 to 1819 (Decrease indent by 12 spaces)
let email = lines.slice(1766, 1819).map(line => line.replace(/^ {12}/, ''));
newLines = newLines.concat(email);
newLines.push('');

// 8. module.exports: Lines 1820 to 1828 (Decrease indent by 12 spaces)
let exportsBlock = lines.slice(1819, 1829).map(line => line.replace(/^ {12}/, ''));
newLines = newLines.concat(exportsBlock);

// Clear and rebuild from slices to avoid duplicates:
newLines = [];
newLines = newLines.concat(lines.slice(0, 55));
newLines.push('');
newLines = newLines.concat(gstr3bHtml);
newLines.push('');
newLines = newLines.concat(reportHtml);
newLines.push('');
newLines = newLines.concat(reportPdf);
newLines.push('');
newLines = newLines.concat(excelHelpers);
newLines.push('');
newLines = newLines.concat(reportExcel);
newLines.push('');
newLines = newLines.concat(email);
newLines.push('');
newLines = newLines.concat(exportsBlock);


fs.writeFileSync(filepath, newLines.join('\n'), 'utf8');
console.log("File fixed!");
