const OtherIncome = require('../../models/Expense-Income-Model/OtherIncome');
const DailyExpenseCustomField = require('../../models/Expense-Income-Model/DailyExpenseCustomField');
const DailyExpenseImport = require('../../models/Expense-Income-Model/DailyExpenseImport');
const { generateReceiptPDF } = require('../../utils/pdfHelper');
const { generateOtherIncomePDF } = require('../../utils/otherIncomePdfHelper');
const { sendEmail } = require('../../utils/emailHelper');
const numberToWords = require('../../utils/numberToWords');
const User = require('../../models/User-Model/User');
const BankDetails = require('../../models/Other-Document-Model/BankDetail');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const mongoose = require('mongoose');

// Helper to build shared search query
const buildIncomeQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        search,
        fromDate,
        toDate,
        category,
        incomeNo,
        paymentType,
        minAmount,
        maxAmount,
        ...otherFilters
    } = queryParams;

    if (category) query.category = { $regex: category, $options: 'i' };

    if (fromDate || toDate) {
        query.incomeDate = {};
        if (fromDate) query.incomeDate.$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query.incomeDate.$lte = end;
        }
    }

    if (search || incomeNo) {
        const term = search || incomeNo;
        query.incomeNo = { $regex: term, $options: 'i' };
    }

    if (paymentType) query.paymentType = paymentType;

    if (minAmount || maxAmount) {
        query.grandTotal = {};
        if (minAmount) query.grandTotal.$gte = Number(minAmount);
        if (maxAmount) query.grandTotal.$lte = Number(maxAmount);
    }

    // Custom Fields filters
    for (const key in otherFilters) {
        if (key.startsWith('cf_')) {
            const fieldId = key.replace('cf_', '');
            query[`customFields.${fieldId}`] = otherFilters[key];
        }
    }

    return query;
};

// @desc    Create Other Income
// @route   POST /api/other-incomes
const createIncome = async (req, res) => {
    try {
        const { print = false, customFields, ...data } = req.body;

        // --- Custom Fields Validation ---
        let parsedCustomFields = {};
        if (customFields) {
            try {
                parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid format for customFields' });
            }
        }

        const definitions = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });
        for (const def of definitions) {
            if (def.required && !parsedCustomFields[def._id.toString()]) {
                return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
            }
        }

        // Calculate items and totals strictly
        let calculatedTotal = 0;
        const processedItems = data.items.map(item => {
            const amount = item.price; // price is line amount here
            calculatedTotal += amount;
            return { ...item, amount };
        });

        const grandTotal = calculatedTotal + (Number(data.roundOff) || 0);

        const newIncome = new OtherIncome({
            ...data,
            customFields: parsedCustomFields,
            items: processedItems,
            totalInvoiceValue: calculatedTotal,
            grandTotal,
            userId: req.user._id
        });

        await newIncome.save();

        if (print) {
            // Filter printable custom fields
            const printableFields = definitions
                .filter(def => def.print && parsedCustomFields[def._id.toString()])
                .map(def => ({ name: def.name, value: parsedCustomFields[def._id.toString()] }));

            const pdfBuffer = await generateReceiptPDF({
                no: newIncome.incomeNo,
                date: newIncome.incomeDate,
                category: newIncome.category,
                paymentType: newIncome.paymentType,
                remarks: newIncome.remarks,
                items: newIncome.items.map(i => ({ name: i.incomeName, amount: i.amount })),
                grandTotal: newIncome.grandTotal,
                amountInWords: newIncome.amountInWords,
                customFields: printableFields
            }, "INCOME");

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=income-${newIncome.incomeNo}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({ success: true, data: newIncome });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Get Other Incomes / Search
// @route   GET /api/other-incomes
const getIncomes = async (req, res) => {
    try {
        const query = await buildIncomeQuery(req.user._id, req.query);
        const incomes = await OtherIncome.find(query).sort({ incomeDate: -1 });
        res.status(200).json({ success: true, count: incomes.length, data: incomes });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get Income Summary
// @route   GET /api/other-incomes/summary
const getIncomeSummary = async (req, res) => {
    try {
        const query = await buildIncomeQuery(req.user._id, req.query);
        const stats = await OtherIncome.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalValue: { $sum: '$grandTotal' }
                }
            }
        ]);

        const summary = stats.length > 0 ? stats[0] : { totalTransactions: 0, totalValue: 0 };
        delete summary._id;

        res.status(200).json({ success: true, data: summary });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get Single Income / Print
// @route   GET /api/other-incomes/:id/print
const printIncome = async (req, res) => {
    try {
        const income = await OtherIncome.findOne({ _id: req.params.id, userId: req.user._id });
        if (!income) return res.status(404).json({ success: false, message: 'Not found' });

        const definitions = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active', print: true });
        const printableFields = definitions
            .filter(def => income.customFields.get(def._id.toString()))
            .map(def => ({ name: def.name, value: income.customFields.get(def._id.toString()) }));

        const pdfBuffer = await generateReceiptPDF({
            no: income.incomeNo,
            date: income.incomeDate,
            category: income.category,
            paymentType: income.paymentType,
            remarks: income.remarks,
            items: income.items.map(i => ({ name: i.incomeName, amount: i.amount })),
            grandTotal: income.grandTotal,
            amountInWords: income.amountInWords,
            customFields: printableFields
        }, "INCOME");

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=income-${income.incomeNo}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Import incomes from Excel
// @route   POST /api/other-incomes/import
const importIncomes = async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload an Excel file' });

    const importLog = new DailyExpenseImport({
        userId: req.user._id,
        fileName: req.file.originalname,
        status: 'Pending'
    });
    await importLog.save();

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);
        const worksheet = workbook.getWorksheet(1);
        if (!worksheet || worksheet.rowCount <= 1) {
            importLog.status = 'Failed';
            importLog.errorLogs.push({ error: 'Excel sheet is empty' });
            await importLog.save();
            return res.status(400).json({ success: false, message: 'Excel sheet is empty' });
        }

        const headerRow = worksheet.getRow(1);
        const fieldIndices = {};
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            const header = cell.value?.toString().trim().toLowerCase();
            if (header) fieldIndices[header] = colNumber;
        });

        const getVal = (row, header) => {
            const index = fieldIndices[header.toLowerCase()];
            if (!index) return null;
            const cell = row.getCell(index);
            let val = cell.value;
            if (val && typeof val === 'object') {
                if (val.result !== undefined) val = val.result;
                else if (val.text !== undefined) val = val.text;
            }
            return val;
        };

        const incomesMap = new Map();
        const customFieldDefs = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const incomeNo = getVal(row, 'incomeNo')?.toString().trim();
            if (!incomeNo) return;

            if (!incomesMap.has(incomeNo)) {
                incomesMap.set(incomeNo, {
                    incomeNo,
                    incomeDate: getVal(row, 'incomeDate'),
                    category: getVal(row, 'category')?.toString(),
                    paymentType: getVal(row, 'paymentType')?.toString().toUpperCase() || 'CASH',
                    remarks: getVal(row, 'remarks')?.toString(),
                    roundOff: Number(getVal(row, 'roundOff')) || 0,
                    amountInWords: getVal(row, 'amountInWords')?.toString(),
                    customFields: {},
                    items: [],
                    rowIndex: rowNumber
                });

                customFieldDefs.forEach(def => {
                    const val = getVal(row, `cf_${def._id}`) || getVal(row, def.name);
                    if (val !== null && val !== undefined) {
                        incomesMap.get(incomeNo).customFields[def._id.toString()] = val;
                    }
                });
            }

            const itemName = getVal(row, 'incomeName') || getVal(row, 'name');
            if (itemName) {
                incomesMap.get(incomeNo).items.push({
                    incomeName: itemName.toString(),
                    note: getVal(row, 'note')?.toString(),
                    price: Number(getVal(row, 'price')) || 0,
                });
            }
        });

        let imported = 0, failed = 0;
        for (const [no, data] of incomesMap.entries()) {
            try {
                const existing = await OtherIncome.findOne({ userId: req.user._id, incomeNo: no });
                if (existing) throw new Error('Duplicate incomeNo');

                let total = 0;
                const items = data.items.map(i => {
                    total += i.price;
                    return { ...i, amount: i.price };
                });

                await OtherIncome.create({
                    ...data,
                    items,
                    totalInvoiceValue: total,
                    grandTotal: total + data.roundOff,
                    userId: req.user._id
                });
                imported++;
            } catch (err) {
                failed++;
                importLog.errorLogs.push({ expenseNo: no, row: data.rowIndex, error: err.message });
            }
        }

        importLog.status = 'Completed';
        importLog.totalRows = incomesMap.size;
        importLog.importedCount = imported;
        importLog.failedCount = failed;
        await importLog.save();

        res.status(200).json({ success: true, message: `Imported ${imported}, Failed ${failed}` });
    } catch (error) {
        importLog.status = 'Failed';
        importLog.errorLogs.push({ error: error.message });
        await importLog.save();
        res.status(500).json({ success: false, message: 'Import failed' });
    }
};

const downloadImportSample = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Other Income Sample');

        // Fetch active custom fields to include in headers
        const customFieldDefs = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });

        // Define base columns
        const columns = [
            { header: 'incomeNo', key: 'incomeNo', width: 15 },
            { header: 'incomeDate', key: 'incomeDate', width: 15 },
            { header: 'category', key: 'category', width: 15 },
            { header: 'paymentType', key: 'paymentType', width: 15 },
            { header: 'roundOff', key: 'roundOff', width: 10 },
            { header: 'incomeName', key: 'incomeName', width: 25 },
            { header: 'itemNote', key: 'itemNote', width: 25 },
            { header: 'price', key: 'price', width: 15 },
            { header: 'amountInWords', key: 'amountInWords', width: 30 },
            { header: 'remarks', key: 'remarks', width: 30 }
        ];

        // Add custom field columns
        customFieldDefs.forEach(def => {
            columns.push({
                header: `cf_${def.name.toLowerCase().replace(/\s+/g, '_')}`, // user-friendly cf_name
                key: `cf_${def._id}`, // unique ID for parsing
                width: 20
            });
        });

        worksheet.columns = columns;

        // Styling headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Add sample row
        const sampleRow = {
            incomeNo: 'INC-001',
            incomeDate: new Date().toISOString().split('T')[0],
            category: 'Sales',
            paymentType: 'CASH',
            roundOff: 0,
            incomeName: 'Consulting Fee',
            itemNote: 'Project Alpha',
            price: 5000,
            amountInWords: 'Five Thousand Only',
            remarks: 'Monthly consulting'
        };

        // Fill sample values for custom fields (if any)
        customFieldDefs.forEach(def => {
            sampleRow[`cf_${def._id}`] = def.type === 'DROPDOWN' ? def.options[0] : 'Sample Value';
        });

        worksheet.addRow(sampleRow);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=other-income-sample.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Download Sample Error:', error);
        res.status(500).json({ success: false, message: 'Error generating sample file' });
    }
};

// @desc    Get Single Other Income
// @route   GET /api/other-incomes/:id
const getIncome = async (req, res) => {
    try {
        const income = await OtherIncome.findOne({ _id: req.params.id, userId: req.user._id });
        if (!income) return res.status(404).json({ success: false, message: 'Income record not found' });
        res.status(200).json({ success: true, data: income });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update Other Income
// @route   PUT /api/other-incomes/:id
const updateIncome = async (req, res) => {
    try {
        const { customFields, ...data } = req.body;

        let income = await OtherIncome.findOne({ _id: req.params.id, userId: req.user._id });
        if (!income) return res.status(404).json({ success: false, message: 'Income record not found' });

        // --- Custom Fields Validation ---
        let parsedCustomFields = {};
        if (customFields) {
            try {
                parsedCustomFields = typeof customFields === 'string' ? JSON.parse(customFields) : customFields;
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid format for customFields' });
            }
        }

        const definitions = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });
        if (customFields) {
            for (const def of definitions) {
                if (def.required && !parsedCustomFields[def._id.toString()]) {
                    return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
                }
            }
        }

        // Recalculate items and totals if items are provided
        if (data.items) {
            let calculatedTotal = 0;
            const processedItems = data.items.map(item => {
                const amount = item.price;
                calculatedTotal += amount;
                return { ...item, amount };
            });
            income.items = processedItems;
            income.totalInvoiceValue = calculatedTotal;
            income.grandTotal = calculatedTotal + (Number(data.roundOff || income.roundOff) || 0);
        } else if (data.roundOff !== undefined) {
            income.grandTotal = income.totalInvoiceValue + Number(data.roundOff);
        }

        // Update other fields
        const fieldsToUpdate = ['incomeNo', 'incomeDate', 'category', 'paymentType', 'remarks', 'amountInWords', 'roundOff'];
        fieldsToUpdate.forEach(field => {
            if (data[field] !== undefined) income[field] = data[field];
        });

        if (customFields) income.customFields = parsedCustomFields;

        await income.save();
        res.status(200).json({ success: true, message: 'Other income updated successfully', data: income });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error', error: error.message });
    }
};

// @desc    Delete Other Income
// @route   DELETE /api/other-incomes/:id
const deleteIncome = async (req, res) => {
    try {
        const income = await OtherIncome.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
        if (!income) return res.status(404).json({ success: false, message: 'Income record not found' });
        res.status(200).json({ success: true, message: 'Other income deleted permanently' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// --- PDF & SHARING HELPERS ---
const getCopyOptions = (req) => {
    const source = { ...req.query, ...req.body };
    const { original, duplicate, transport, office } = source;
    return {
        original: original === 'true' || original === true || original === undefined,
        duplicate: duplicate === 'true' || duplicate === true,
        transport: transport === 'true' || transport === true,
        office: office === 'true' || office === true
    };
};

const generatePublicToken = (id) => {
    return crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(id.toString()).digest('hex').substring(0, 16);
};

const mapIncomeToPDFData = async (income, userId) => {
    // Custom Fields (Printable)
    const definitions = await DailyExpenseCustomField.find({ userId, status: 'Active', print: true });
    const printableFields = definitions
        .filter(def => income.customFields && income.customFields.get && income.customFields.get(def._id.toString()))
        .map(def => ({ name: def.name, value: income.customFields.get(def._id.toString()) }));

    // Bank Details
    const bank = await BankDetails.findOne({ userId });

    return {
        no: income.incomeNo,
        date: income.incomeDate,
        category: income.category,
        paymentType: income.paymentType,
        remarks: income.remarks,
        items: income.items.map(i => ({
            name: i.incomeName,
            rate: i.price,
            total: i.amount
        })),
        grandTotal: income.grandTotal,
        totalInWords: income.amountInWords || (typeof numberToWords === 'function' ? numberToWords(income.grandTotal) : ""),
        customFields: printableFields,
        bankDetails: bank ? {
            bankName: bank.bankName,
            accountNumber: bank.accountNumber,
            ifsc: bank.ifscCode,
            branch: bank.branchName
        } : null
    };
};

// @desc    Download Other Income PDF (Single or Merged)
// @route   GET /api/other-incomes/:id/download-pdf
const downloadIncomePDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
        const incomes = await OtherIncome.find({ _id: { $in: ids }, userId: req.user._id });
        if (!incomes || incomes.length === 0) return res.status(404).json({ success: false, message: 'Income record not found' });

        const user = await User.findById(req.user._id);
        const allPdfData = await Promise.all(incomes.map(inc => mapIncomeToPDFData(inc, req.user._id)));
        const options = getCopyOptions(req);

        const pdfBuffer = await generateOtherIncomePDF(allPdfData, user, options);

        const filename = incomes.length === 1 ? `Income_${incomes[0].incomeNo}.pdf` : 'Incomes_Merged.pdf';
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Download PDF Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Share Other Income via Email (Single or Merged)
// @route   POST /api/other-incomes/:id/share-email
const shareIncomeEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const ids = req.params.id.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
        const incomes = await OtherIncome.find({ _id: { $in: ids }, userId: req.user._id });
        if (!incomes || incomes.length === 0) return res.status(404).json({ success: false, message: 'Income record not found' });

        const user = await User.findById(req.user._id);
        const allPdfData = await Promise.all(incomes.map(inc => mapIncomeToPDFData(inc, req.user._id)));
        const options = getCopyOptions(req);
        const pdfBuffer = await generateOtherIncomePDF(allPdfData, user, options);

        const filename = incomes.length === 1 ? `Income_${incomes[0].incomeNo}.pdf` : 'Incomes_Merged.pdf';
        const subject = incomes.length === 1 ? `Income Receipt - ${incomes[0].incomeNo}` : 'Merged Income Receipts';

        await sendEmail({
            to: email,
            subject: subject,
            text: `Please find attached the income receipt(s).`,
            attachments: [{
                filename: filename,
                content: pdfBuffer
            }]
        });

        res.status(200).json({ success: true, message: 'Email sent successfully' });
    } catch (error) {
        console.error('Share Email Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Share Other Income via WhatsApp (Single or Merged)
// @route   POST /api/other-incomes/:id/share-whatsapp
const shareIncomeWhatsApp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return res.status(400).json({ success: false, message: 'Mobile number is required' });

        const ids = req.params.id.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
        const incomes = await OtherIncome.find({ _id: { $in: ids }, userId: req.user._id });
        if (!incomes || incomes.length === 0) return res.status(404).json({ success: false, message: 'Income record not found' });

        const token = generatePublicToken(req.params.id);
        const options = getCopyOptions(req);
        let qp = [];
        if (options.duplicate) qp.push('duplicate=true');
        if (options.transport) qp.push('transport=true');
        if (options.office) qp.push('office=true');
        const qs = qp.length > 0 ? `?${qp.join('&')}` : '';
        const link = `${req.protocol}://${req.get('host')}/api/other-incomes/view-public/${req.params.id}/${token}${qs}`;

        const message = incomes.length === 1
            ? `Income Receipt: ${incomes[0].incomeNo}\nDate: ${new Date(incomes[0].incomeDate).toLocaleDateString()}\nAmount: ${incomes[0].grandTotal}\nView Link: ${link}`
            : `Multiple Income Receipts (${incomes.length})\nView Merged Link: ${link}`;

        const waLink = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;
        res.status(200).json({ success: true, data: { link: waLink } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Generate a secure public link for Other Income
// @route   GET /api/other-incomes/:id/public-link
const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
        const incomes = await OtherIncome.find({ _id: { $in: ids }, userId: req.user._id });
        if (!incomes || incomes.length === 0) return res.status(404).json({ success: false, message: "Income not found" });

        const token = generatePublicToken(req.params.id);
        const publicLink = `${req.protocol}://${req.get('host')}/api/other-incomes/view-public/${req.params.id}/${token}`;
        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Public View Other Income PDF
// @route   GET /api/other-incomes/view-public/:id/:token
const viewIncomePublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        if (token !== generatePublicToken(id)) return res.status(401).send("Invalid or expired link");

        const ids = id.split(',').filter(i => mongoose.Types.ObjectId.isValid(i));
        const incomes = await OtherIncome.find({ _id: { $in: ids } });
        if (!incomes || incomes.length === 0) return res.status(404).send("Income not found");

        const userId = incomes[0].userId;
        const user = await User.findById(userId);
        const allPdfData = await Promise.all(incomes.map(inc => mapIncomeToPDFData(inc, userId)));
        const options = getCopyOptions(req);
        const pdfBuffer = await generateOtherIncomePDF(allPdfData, user || {}, options);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Income.pdf"');
        res.send(pdfBuffer);
    } catch (error) {
        res.status(500).send("Error rendering PDF");
    }
};

module.exports = {
    createIncome,
    getIncomes,
    getIncomeSummary,
    printIncome,
    importIncomes,
    downloadImportSample,
    getIncome,
    updateIncome,
    deleteIncome,
    downloadIncomePDF,
    shareIncomeEmail,
    shareIncomeWhatsApp,
    generatePublicLink,
    viewIncomePublic
};
