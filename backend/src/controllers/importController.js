const Customer = require('../models/Customer');
const ImportLog = require('../models/ImportLog');
const ExcelJS = require('exceljs');
const stream = require('stream');

// Safely extract string value from cell
const getCellValue = (cell) => {
    if (!cell || cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'object') {
        if (cell.value.text) return cell.value.text; // Rich text
        if (cell.value.result) return cell.value.result; // Formula
    }
    return cell.value.toString().trim();
};

const importCustomers = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'Please upload a file (Excel or CSV)' });
    }

    try {
        const workbook = new ExcelJS.Workbook();

        // Load workbook based on type
        if (req.file.mimetype.includes('csv') || req.file.originalname.toLowerCase().endsWith('.csv')) {
            const bufferStream = new stream.PassThrough();
            bufferStream.end(req.file.buffer);
            await workbook.csv.read(bufferStream);
        } else {
            await workbook.xlsx.load(req.file.buffer);
        }

        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
            return res.status(400).json({ message: 'Invalid or empty file' });
        }

        const validRecords = [];
        const duplicateRecords = [];
        const invalidRecords = [];
        const rowsToProcess = [];

        // 1. Identify Headers (Row 1)
        const headerRow = worksheet.getRow(1);
        const headers = {};

        headerRow.eachCell((cell, colNumber) => {
            const val = getCellValue(cell).toLowerCase();
            if (val.includes('name')) headers.companyName = colNumber;
            if (val.includes('city')) headers.city = colNumber;
            if (val.includes('state')) headers.state = colNumber;
            if (val.includes('country')) headers.country = colNumber;
            if (val.includes('gstin')) headers.gstin = colNumber;
            if (val.includes('email')) headers.email = colNumber;
        });

        // 2. Read all rows first
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const rowData = {
                companyName: headers.companyName ? getCellValue(row.getCell(headers.companyName)) : '',
                city: headers.city ? getCellValue(row.getCell(headers.city)) : '',
                state: headers.state ? getCellValue(row.getCell(headers.state)) : '',
                country: headers.country ? getCellValue(row.getCell(headers.country)) : '',
                gstin: headers.gstin ? getCellValue(row.getCell(headers.gstin)) : '',
                email: headers.email ? getCellValue(row.getCell(headers.email)) : ''
            };

            // Basic validity check required to even consider it a record? 
            // We will process all non-header rows.
            rowsToProcess.push({ rowNumber, data: rowData });
        });

        const totalRecords = rowsToProcess.length;

        // 3. Fetch existing customers for duplicate checking
        const existingCustomers = await Customer.find({ userId: req.user._id })
            .select('companyName gstin email');

        // 4. Process each row
        for (const item of rowsToProcess) {
            const { rowNumber, data } = item;

            // Step A: Validation (Required fields)
            const missingFields = [];
            if (!data.companyName) missingFields.push('Company Name');
            if (!data.city) missingFields.push('City');
            if (!data.state) missingFields.push('State');
            if (!data.country) missingFields.push('Country');

            if (missingFields.length > 0) {
                invalidRecords.push({
                    recordNumber: rowNumber,
                    status: 'Invalid',
                    reason: `Missing required fields: ${missingFields.join(', ')}`,
                    data
                });
                continue;
            }

            // Step B: Duplicate Check
            // Rule: "Company Name + GSTIN + Email combination"
            // We check for exact match of this combination.
            // However, typical deduplication also flags if just Email or GSTIN exists.
            // Given the prompt "Duplicate records (already exist based on Company Name + GSTIN or Email)", 
            // AND "Detect Duplicate records using Company Name + GSTIN + Email combination".
            // I will implement a check that covers the "combination" of identity.

            const isDuplicate = existingCustomers.some(existing => {
                const nameMatch = existing.companyName.toLowerCase() === data.companyName.toLowerCase();
                const gstinMatch = data.gstin && existing.gstin && (existing.gstin.toLowerCase() === data.gstin.toLowerCase());
                const emailMatch = data.email && existing.email && (existing.email.toLowerCase() === data.email.toLowerCase());

                // If the prompt implies logical OR between (Name+GSTIN) and (Email):
                // "already exist based on Company Name + GSTIN or Email" <- Previous prompt logic?
                // "Company Name + GSTIN + Email combination" <- Current prompt.

                // If I implement strictly Name + GSTIN + Email, then someone with same Email but different Name is NOT a duplicate? That seems wrong for unique email fields.
                // I will assume the user wants:
                // 1. Email must be unique.
                // 2. Name + GSTIN must be unique.

                if (emailMatch) return true;
                if (nameMatch && gstinMatch) return true;
                // If name matches but no GSTIN provided/exist?
                // Let's stick to the strongest indicators.

                return false;
            });

            if (isDuplicate) {
                duplicateRecords.push({
                    recordNumber: rowNumber,
                    status: 'Duplicate',
                    reason: 'Record already exists (Name + GSTIN or Email match)',
                    data
                });
                continue;
            }

            // Step C: Valid
            validRecords.push({
                recordNumber: rowNumber,
                status: 'Success',
                data
            });
        }

        // 5. Save Valid Records
        if (validRecords.length > 0) {
            const docsToSave = validRecords.map(v => ({
                userId: req.user._id,
                companyName: v.data.companyName,
                gstin: v.data.gstin,
                email: v.data.email,
                billingAddress: {
                    city: v.data.city,
                    state: v.data.state,
                    country: v.data.country
                }
            }));
            await Customer.insertMany(docsToSave);
        }

        // 6. Log Import
        await ImportLog.create({
            userId: req.user._id,
            filename: req.file.originalname,
            totalRecords: totalRecords,
            successCount: validRecords.length,
            duplicateCount: duplicateRecords.length,
            invalidCount: invalidRecords.length
        });

        // 7. Response Structure
        // "record number, total processed range (1-3, 4-6…), status summary (Completed), and in Action section allow details..."
        // I will return a flat list or the structured object as requested.

        const actionDetails = [
            ...validRecords.map(r => ({ ...r, action: 'Successfully Imported' })),
            ...duplicateRecords.map(r => ({ ...r, action: 'Duplicate', details: r.data })),
            ...invalidRecords.map(r => ({ ...r, action: 'Invalid', details: r.reason }))
        ].sort((a, b) => a.recordNumber - b.recordNumber);

        res.status(200).json({
            recordNumber: totalRecords,
            processedRange: `1-${totalRecords}`,
            statusSummary: 'Completed',
            action: actionDetails,
            summary: {
                total: totalRecords,
                success: validRecords.length,
                duplicate: duplicateRecords.length,
                invalid: invalidRecords.length
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server Error during import', error: error.message });
    }
};

module.exports = { importCustomers };
