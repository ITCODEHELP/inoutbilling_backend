const Product = require('../models/Product');
const BulkEditLog = require('../models/BulkEditLog');
const ExcelJS = require('exceljs');
const stream = require('stream');

const REQUIRED_HEADERS = [
    'Product id', 'Product name', 'Product note', 'Barcode no', 'Sell price', 'Sell price incl tax',
    'Purchase price', 'Purchase price incl tax', 'Hsn/sac code', 'Unit of measurement', 'Product type',
    'No-itc', 'Gst %', 'Cess %', 'Cess type', 'Active product', 'Is service product ?', 'Non-salable product?',
    'Product group', 'Stock type', 'Stock id', 'Batch no', 'Model no', 'Size', 'Mfg date', 'Expiry date',
    'Mrp', 'Low stock alert', 'Discount sale', 'Discount in sale', 'Discount purchase', 'Discount in purchase',
    'Product code', 'Is manufacturing', 'Gstin', 'Category', 'Date', 'Expense type', 'Discount in',
    'Title', 'Description', 'Quantity', 'Rate', 'Uom', 'Discount', 'Taxable / amount', 'Tax%', 'Cess%'
];

const normalize = (str) => str ? str.toString().trim() : '';
const getCellValue = (row, colIndex) => {
    const cell = row.getCell(colIndex);
    if (!cell || cell.value === null) return '';
    if (typeof cell.value === 'object') {
        if (cell.value.text) return cell.value.text;
        if (cell.value.result) return cell.value.result;
    }
    return cell.value.toString().trim();
};

const importBulkEdit = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Please upload a file (Excel or CSV)' });

    try {
        const workbook = new ExcelJS.Workbook();
        if (req.file.mimetype.includes('csv') || req.file.originalname.toLowerCase().endsWith('.csv')) {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(req.file.buffer);
            await workbook.csv.read(bufferStream);
        } else {
            await workbook.xlsx.load(req.file.buffer);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) return res.status(400).json({ message: 'Invalid or empty file' });

        const headerRow = worksheet.getRow(1);
        const headersMap = {};
        headerRow.eachCell((cell, colNumber) => {
            headersMap[normalize(getCellValue(headerRow, colNumber)).toLowerCase()] = colNumber;
        });

        const missing = REQUIRED_HEADERS.filter(h => !headersMap[h.toLowerCase()]);
        if (missing.length > 0) return res.status(400).json({ message: `Missing headers: ${missing.join(', ')}` });

        const logs = [];
        let successCount = 0, duplicateCount = 0, invalidCount = 0;
        const rowsToProcess = [];
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            rowsToProcess.push({ row, rowNumber });
        });

        for (const { row, rowNumber } of rowsToProcess) {
            const getVal = (h) => getCellValue(row, headersMap[h.toLowerCase()]);
            const pid = getVal('Product id');

            if (!pid) {
                invalidCount++;
                logs.push({ recordNumber: rowNumber, status: 'Invalid', action: 'Skipped', details: 'Missing Product id' });
                continue;
            }

            const product = await Product.findOne({ _id: pid, userId: req.user._id });
            if (!product) {
                invalidCount++;
                logs.push({ recordNumber: rowNumber, status: 'Invalid', action: 'Skipped', details: `Product ID ${pid} not found` });
                continue;
            }

            const updates = {
                name: getVal('Product name') || product.name,
                productNote: getVal('Product note') || product.productNote,
                barcode: getVal('Barcode no') || product.barcode,
                sellPrice: parseFloat(getVal('Sell price')) || product.sellPrice,
                purchasePrice: parseFloat(getVal('Purchase price')) || product.purchasePrice,
                hsnSac: getVal('Hsn/sac code') || product.hsnSac,
                unit: getVal('Unit of measurement') || product.unit,
                productGroup: getVal('Product group') || product.productGroup,
                itemType: getVal('Product type') === 'Service' ? 'Service' : 'Product'
            };
            const tax = parseFloat(getVal('Gst %'));
            if (!isNaN(tax)) updates.tax = tax;

            try {
                await Product.findByIdAndUpdate(pid, updates);
                successCount++;
                logs.push({ recordNumber: rowNumber, status: 'Success', action: 'Updated', details: `Updated ${product.name}` });
            } catch (err) {
                invalidCount++;
                logs.push({ recordNumber: rowNumber, status: 'Invalid', action: 'Error', details: err.message });
            }
        }

        const log = await BulkEditLog.create({
            userId: req.user._id,
            filename: req.file.originalname,
            totalRecords: rowsToProcess.length,
            successCount, duplicateCount, invalidCount, details: logs
        });

        res.json({
            recordNumber: rowsToProcess.length,
            processedRange: `1-${rowsToProcess.length}`,
            statusSummary: 'Completed',
            summary: { total: rowsToProcess.length, success: successCount, duplicate: duplicateCount, invalid: invalidCount },
            logId: log._id
        });

    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

const getBulkEditLogs = async (req, res) => {
    try {
        const logs = await BulkEditLog.find({ userId: req.user._id }).select('-details').sort({ createdAt: -1 });
        res.json(logs);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

const getBulkEditLogDetails = async (req, res) => {
    try {
        const log = await BulkEditLog.findOne({ _id: req.params.id, userId: req.user._id });
        if (!log) return res.status(404).json({ message: 'Log not found' });
        res.json(log);
    } catch (err) { res.status(500).json({ message: err.message }); }
};

const exportBulkEdit = async (req, res) => {
    try {
        const products = await Product.find({ userId: req.user._id });
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Products');
        worksheet.columns = REQUIRED_HEADERS.map(h => ({ header: h, key: h, width: 15 }));

        const rows = products.map(p => {
            const r = {};
            REQUIRED_HEADERS.forEach(h => r[h] = '');
            r['Product id'] = p._id.toString();
            r['Product name'] = p.name;
            r['Product note'] = p.productNote;
            r['Barcode no'] = p.barcode;
            r['Sell price'] = p.sellPrice;
            r['Purchase price'] = p.purchasePrice;
            r['Gst %'] = p.tax;
            r['Product type'] = p.itemType;
            r['Active product'] = 'True';
            return r;
        });
        worksheet.addRows(rows);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_bulk_edit.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) { res.status(500).json({ message: err.message }); }
};

module.exports = { importBulkEdit, getBulkEditLogs, getBulkEditLogDetails, exportBulkEdit };
