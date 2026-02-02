const ExcelJS = require('exceljs');
const BankStatementImport = require('../../models/Bank-Statement-Model/BankStatementImport');
const path = require('path');
const fs = require('fs');

/**
 * @desc    Get Sample Bank Statement Excel
 * @route   GET /api/bank-statements/sample
 * @access  Private
 */
const getSampleBankStatement = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bank Statement');

        // Define Headers fitting the screenshot
        worksheet.columns = [
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 40 },
            { header: 'Debit', key: 'debit', width: 15 },
            { header: 'Credit', key: 'credit', width: 15 }
        ];

        // Add Sample Data
        const sampleData = [
            { date: '06-May-24', description: 'UPI-303702011409044-9307676700@UPI-81561', debit: '', credit: 1500.00 },
            { date: '06-Jul-24', description: 'EMI 50037630 CHQ S500376300091 061850037', debit: 5333.00, credit: '' },
            { date: '06-Sep-24', description: 'NHDF6376325463/SBI CARDS', debit: 2820.00, credit: '' },
            { date: '06-Dec-24', description: 'NHDF6385796167/BILLDKVODAFONEINDIAL', debit: 119.18, credit: '' },
            { date: '07-Dec-24', description: 'ACH D- TP ACH HOME-105909750', debit: 2284.98, credit: '' },
            { date: '08-Dec-24', description: 'NEFT DR-VIJB0005051-PANKAJ KUMAR SINGH-N', debit: 4000.00, credit: '' },
            { date: '09-Dec-24', description: 'UPI-303702011409044-9307676700@UPI-81701', debit: '', credit: 2300.00 },
            { date: '10-Dec-24', description: 'NHDF6406143679/BILLDKKOTAKCARDS', debit: 11445.00, credit: '' },
            { date: '11-Dec-24', description: 'ACH D- HOMECRINDFINPVTLTD-38005587800106', debit: 1315.00, credit: '' },
            { date: '12-Dec-24', description: 'POS 416021XXXXXX8060 DCSIRELIANCE POS DE', debit: 1760.00, credit: '' },
            { date: '13-Dec-24', description: 'NEFT DR-UBIN0539686-RAJU DUBEY-NETBANK,', debit: 1000.00, credit: '' },
            { date: '07-Jan-24', description: 'CREDIT INTEREST CAPITALISED', debit: '', credit: 156.00 },
            { date: '07-Feb-24', description: 'MICRO ATM CASH DEP - HDFC', debit: '', credit: 10000.00 },
            { date: '07-Feb-24', description: 'IB BILLPAY DR-HDFCPE-545964XXXXXX3563', debit: 3756.00, credit: '' },
            { date: '07-Mar-24', description: 'IMPS-818411585956-ARUNARAVINDRADUBEY-HDF', debit: '', credit: 3000.00 }
        ];

        sampleData.forEach(row => worksheet.addRow(row));

        // Styling headers
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Bank_Statement_Sample.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating sample:', error);
        res.status(500).json({ success: false, message: 'Failed to generate sample file' });
    }
};

/**
 * @desc    Import Bank Statement (CSV/Excel)
 * @route   POST /api/bank-statements/import
 * @access  Private
 */
const importBankStatement = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        const userId = req.user._id;
        const fileBuffer = req.file.buffer;
        const fileName = req.file.originalname;
        const fileType = path.extname(fileName).toLowerCase();

        const workbook = new ExcelJS.Workbook();
        let worksheet;

        // Parse File
        if (fileType === '.csv') {
            await workbook.csv.read(req.file.stream); // Use stream for CSV if available, or buffer? ExcelJS csv read takes stream.
            // Multer memory storage gives buffer. We can crate readable stream.
            const stream = require('stream');
            const bufferStream = new stream.PassThrough();
            bufferStream.end(fileBuffer);
            await workbook.csv.read(bufferStream);
            worksheet = workbook.getWorksheet(1);
        } else if (fileType === '.xlsx' || fileType === '.xls') {
            await workbook.xlsx.load(fileBuffer);
            worksheet = workbook.getWorksheet(1);
        } else {
            return res.status(400).json({ success: false, message: 'Invalid file format. Use CSV, XLS, or XLSX' });
        }

        const parsedRecords = [];
        let rowCount = 0;

        // Iterate Rows (Assuming Header is Row 1)
        // Adjust if needed. ExcelJS iterates 1-based.
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip Header

            // Map columns based on screenshot/sample
            // Col 1=Date, 2=Description, 3=Debit, 4=Credit
            // Check headers dynamically? Or assume fixed structure? 
            // User requested "normalize headers", implies dynamic.
            // But simplify for now: assume standard order or mapping. 
            // Let's look at row 1 values to map indices.

            // For this implementation, I will assume the structure matches the sample.
            // Date(1), Desc(2), Debit(3), Credit(4)

            const rawDate = row.getCell(1).value;
            const description = row.getCell(2).text || row.getCell(2).value;
            let debit = row.getCell(3).value;
            let credit = row.getCell(4).value;

            // Header Row check helper (if logic needed):
            // if (rowNumber === 1) { /* map indices */ return; }

            // Validate/Normalize Data
            if (!rawDate && !description && !debit && !credit) return; // Skip empty row

            // Date Parsing
            let date;
            if (rawDate instanceof Date) {
                date = rawDate;
            } else {
                date = new Date(rawDate); // Try standard parse
            }
            if (isNaN(date.getTime())) date = null; // Invalid date

            // Amount Parsing
            debit = parseFloat(debit) || 0;
            credit = parseFloat(credit) || 0;

            parsedRecords.push({
                date,
                description,
                debit,
                credit,
                balance: 0, // Placeholder
                status: 'valid' // Can add dupe check logic here
            });
            rowCount++;
        });

        // Save Import Record
        const importRecord = await BankStatementImport.create({
            userId,
            fileName,
            fileType,
            fileSize: req.file.size,
            totalRecords: rowCount,
            parsedTransactions: parsedRecords
        });

        return res.status(200).json({
            success: true,
            message: 'File imported successfully',
            data: {
                importId: importRecord._id,
                transactions: parsedRecords
            }
        });

    } catch (error) {
        console.error('Error importing statement:', error);
        return res.status(500).json({ success: false, message: 'Failed to import file', error: error.message });
    }
};

const PDFDocument = require('pdfkit');
const BankDetails = require('../../models/Other-Document-Model/BankDetail');
const mongoose = require('mongoose');

// Helper to fetch filtered transactions for export
const fetchTransactionsForExport = async (userId, query) => {
    const {
        id, // Bank ID (optional but recommended)
        dateFrom,
        dateTo,
        description,
        type,
        amount,
        status
    } = query;

    const initialMatch = {
        userId: new mongoose.Types.ObjectId(userId)
    };
    if (id && mongoose.isValidObjectId(id)) {
        initialMatch._id = new mongoose.Types.ObjectId(id);
    } else if (id) {
        initialMatch.bankId = id;
    }

    const pipeline = [
        { $match: initialMatch },
        { $unwind: "$transactions" }
    ];

    const transactionMatch = {};

    if (dateFrom || dateTo) {
        transactionMatch["transactions.date"] = {};
        if (dateFrom) transactionMatch["transactions.date"].$gte = new Date(dateFrom);
        if (dateTo) transactionMatch["transactions.date"].$lte = new Date(dateTo);
    }

    if (description) {
        transactionMatch.$or = [
            { "transactions.description": { $regex: description, $options: 'i' } },
            { "transactions.remarks": { $regex: description, $options: 'i' } }
        ];
    }

    if (type) {
        transactionMatch["transactions.transactionType"] = { $regex: new RegExp(`^${type}$`, 'i') };
    }

    if (amount) {
        transactionMatch["transactions.amount"] = Number(amount);
    }

    if (status) {
        transactionMatch["transactions.paymentStatus"] = status;
    }

    if (Object.keys(transactionMatch).length > 0) {
        pipeline.push({ $match: transactionMatch });
    }

    // Sort by Date Descending
    pipeline.push({ $sort: { "transactions.date": -1 } });

    // Project needed fields
    pipeline.push({
        $project: {
            bankName: 1, // Include bank name for PDF Header
            date: "$transactions.date",
            description: "$transactions.description",
            remarks: "$transactions.remarks",
            amount: "$transactions.amount",
            paymentStatus: "$transactions.paymentStatus",
            transactionType: "$transactions.transactionType"
        }
    });

    return await BankDetails.aggregate(pipeline);
};

/**
 * @desc    Export Bank Statement to Excel
 * @route   GET /api/bank-statements/export/excel
 * @access  Private
 */
const exportBankStatementExcel = async (req, res) => {
    try {
        const transactions = await fetchTransactionsForExport(req.user._id, { ...req.query, id: req.params.id });

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Bank Statement');

        // Headers matching screenshot
        // Transaction Date, Description, Remarks, Amount, Status, debit, credit, Balance, Reference, Transaction Type
        worksheet.columns = [
            { header: 'Transaction Date', key: 'date', width: 15 },
            { header: 'Description', key: 'description', width: 30 },
            { header: 'Remarks', key: 'remarks', width: 20 },
            { header: 'Amount', key: 'amount', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Debit', key: 'debit', width: 15 },
            { header: 'Credit', key: 'credit', width: 15 },
            { header: 'Balance', key: 'balance', width: 15 },
            { header: 'Reference', key: 'reference', width: 15 },
            { header: 'Transaction Type', key: 'type', width: 15 }
        ];

        // Add Data
        transactions.forEach(txn => {
            const isCredit = txn.transactionType.toLowerCase() === 'credit';
            const debit = isCredit ? 0 : txn.amount;
            const credit = isCredit ? txn.amount : 0;

            worksheet.addRow({
                date: txn.date,
                description: txn.description,
                remarks: txn.remarks || '',
                amount: txn.amount,
                status: txn.paymentStatus || 'Unmatched',
                debit: debit,
                credit: credit,
                balance: 0, // Placeholder
                reference: '', // Placeholder
                type: txn.transactionType
            });
        });

        // Styling
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Bank_Statement.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export Excel Error:', error);
        res.status(500).json({ success: false, message: 'Failed to export Excel' });
    }
};

/**
 * @desc    Export Bank Statement to PDF
 * @route   GET /api/bank-statements/export/pdf
 * @access  Private
 */
const exportBankStatementPDF = async (req, res) => {
    try {
        const transactions = await fetchTransactionsForExport(req.user._id, { ...req.query, id: req.params.id });
        const bankName = transactions.length > 0 ? transactions[0].bankName : 'Bank Statement';

        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=Bank_Statement.pdf');

        doc.pipe(res);

        // Header
        doc.fontSize(18).text(bankName, { align: 'left' });
        doc.moveDown();

        // Table Constants
        const tableTop = 100;
        const colX = [30, 90, 200, 250, 310, 350, 400, 450, 500]; // X positions for columns
        const colWidths = [60, 110, 50, 60, 40, 40, 50, 50, 50]; // Approx widths
        let y = tableTop;

        // Headers
        doc.fontSize(8).font('Helvetica-Bold');
        const headers = ['Txn. Date', 'Description', 'Amount', 'Status', 'Debit', 'Credit', 'Balance', 'Reference', 'Txn. Type'];

        headers.forEach((h, i) => {
            doc.text(h, colX[i], y, { width: colWidths[i], align: 'left' });
        });

        // Draw Line
        y += 15;
        doc.moveTo(30, y).lineTo(570, y).stroke();
        y += 10;

        // Rows
        doc.font('Helvetica').fontSize(8);

        transactions.forEach(txn => {
            if (y > 750) { // New Page
                doc.addPage();
                y = 50;
            }

            const isCredit = txn.transactionType.toLowerCase() === 'credit';
            const debit = isCredit ? 0 : txn.amount;
            const credit = isCredit ? txn.amount : 0;
            const dateStr = new Date(txn.date).toLocaleDateString();

            doc.text(dateStr, colX[0], y, { width: colWidths[0] });
            doc.text(txn.description + (txn.remarks ? `\n${txn.remarks}` : ''), colX[1], y, { width: colWidths[1] });
            doc.text(txn.amount.toString(), colX[2], y, { width: colWidths[2] });
            doc.text(txn.paymentStatus || 'Unmatched', colX[3], y, { width: colWidths[3] });
            doc.text(debit.toString(), colX[4], y, { width: colWidths[4] });
            doc.text(credit.toString(), colX[5], y, { width: colWidths[5] });
            doc.text('0', colX[6], y, { width: colWidths[6] }); // Balance
            doc.text('', colX[7], y, { width: colWidths[7] }); // Reference
            doc.text(txn.transactionType, colX[8], y, { width: colWidths[8] });

            y += 20;
            // Handle multiline description height adjustment if needed
            // For simplicity, fixed spacing or relying on pdfkit basic wrapping
            if (txn.remarks) y += 10; // Extra space for remarks
        });

        doc.end();

    } catch (error) {
        console.error('Export PDF Error:', error);
        res.status(500).json({ success: false, message: 'Failed to export PDF' });
    }
};

module.exports = {
    getSampleBankStatement,
    importBankStatement,
    exportBankStatementExcel,
    exportBankStatementPDF
};
