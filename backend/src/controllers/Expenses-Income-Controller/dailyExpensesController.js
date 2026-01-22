const DailyExpense = require('../../models/Expense-Income-Model/DailyExpense');
const DailyExpenseCustomField = require('../../models/Expense-Income-Model/DailyExpenseCustomField');
const DailyExpenseItemColumn = require('../../models/Expense-Income-Model/DailyExpenseItemColumn');
const DailyExpenseImport = require('../../models/Expense-Income-Model/DailyExpenseImport');
const Vendor = require('../../models/Customer-Vendor-Model/Vendor');
const Staff = require('../../models/Setting-Model/Staff');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const { generateReceiptPDF } = require('../../utils/pdfHelper');

// Helper to build shared search query
const buildExpenseQuery = async (userId, queryParams) => {
    let query = { userId };
    const {
        companyName,
        staffName,
        category,
        fromDate,
        toDate,
        title,
        itemNote,
        paymentType,
        minAmount,
        maxAmount,
        expenseNo,
        ...otherFilters
    } = queryParams;

    // Resolve Vendor IDs from company name
    if (companyName) {
        const vendors = await Vendor.find({
            userId,
            companyName: { $regex: companyName, $options: 'i' }
        }).select('_id');
        query.party = { $in: vendors.map(v => v._id) };
    }

    // Resolve Staff IDs from staff name
    if (staffName) {
        const staffDocs = await Staff.find({
            ownerRef: userId,
            fullName: { $regex: staffName, $options: 'i' }
        }).select('_id');
        query.staff = { $in: staffDocs.map(s => s._id) };
    }

    if (category) {
        query.category = { $regex: category, $options: 'i' };
    }

    if (fromDate || toDate) {
        query.expenseDate = {};
        if (fromDate) query.expenseDate.$gte = new Date(fromDate);
        if (toDate) {
            const end = new Date(toDate);
            end.setHours(23, 59, 59, 999);
            query.expenseDate.$lte = end;
        }
    }

    // Title maps to remarks or description or expenseNo
    if (title) {
        query.$or = [
            { remarks: { $regex: title, $options: 'i' } },
            { description: { $regex: title, $options: 'i' } },
            { expenseNo: { $regex: title, $options: 'i' } }
        ];
    }

    if (itemNote) {
        query.items = { $elemMatch: { note: { $regex: itemNote, $options: 'i' } } };
    }

    if (paymentType) {
        query.paymentType = paymentType;
    }

    if (expenseNo) {
        query.expenseNo = { $regex: expenseNo, $options: 'i' };
    }

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

// @desc    Create a new expense
// @route   POST /api/daily-expenses
// @access  Private
const createExpense = async (req, res) => {
    try {
        const {
            expenseNo,
            expenseDate,
            category,
            isGstBill,
            party, // Vendor/Company ID
            staff, // Staff ID
            paymentType,
            remarks,
            items,
            roundOff,
            amountInWords,
            customFields // JSON stringified object
        } = req.body;

        // --- Custom Fields Validation ---
        let parsedCustomFields = {};
        if (customFields) {
            try {
                parsedCustomFields = JSON.parse(customFields);
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid format for customFields' });
            }
        }

        const definitions = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });
        for (const def of definitions) {
            if (def.required && !parsedCustomFields[def._id.toString()]) {
                return res.status(400).json({ success: false, message: `Field '${def.name}' is required` });
            }
            if (def.type === 'DROPDOWN' && parsedCustomFields[def._id.toString()]) {
                if (!def.options.includes(parsedCustomFields[def._id.toString()])) {
                    return res.status(400).json({ success: false, message: `Invalid option for '${def.name}'` });
                }
            }
        }

        // --- Items Parsing & Strict Calculation ---
        let parsedItems = [];
        if (items) {
            try {
                parsedItems = JSON.parse(items);
            } catch (error) {
                return res.status(400).json({ success: false, message: 'Invalid format for items' });
            }
        }

        let calculatedGrandTotal = 0;
        let calculatedTotalTaxable = 0;

        const finalItems = parsedItems.map(item => {
            const qty = Number(item.quantity) || 0;
            const price = Number(item.price) || 0;
            const lineAmount = qty * price;

            calculatedGrandTotal += lineAmount;
            calculatedTotalTaxable += lineAmount;

            return {
                ...item,
                quantity: qty,
                price: price,
                amount: lineAmount
            };
        });

        // Apply Round Off
        const userRoundOff = Number(roundOff) || 0;
        const finalGrandTotal = calculatedGrandTotal + userRoundOff;

        const newExpense = new DailyExpense({
            userId: req.user._id,
            expenseNo,
            expenseDate,
            category,
            isGstBill: isGstBill === 'true' || isGstBill === true,
            party: party || null,
            staff: staff || null,
            paymentType,
            remarks,
            attachment: req.file ? req.file.path : '',
            items: finalItems,
            roundOff: userRoundOff,
            grandTotal: finalGrandTotal,
            totalTaxable: calculatedTotalTaxable,
            amountInWords,
            customFields: parsedCustomFields
        });

        await newExpense.save();

        if (req.body.print === 'true' || req.body.print === true) {
            const user = await User.findById(req.user._id);
            const pdfData = await mapExpenseToPDFData(newExpense, req.user._id);
            const options = getCopyOptions(req);
            const pdfBuffer = await generateDailyExpensePDF(pdfData, user, options);

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=expense-${newExpense.expenseNo}.pdf`);
            return res.send(pdfBuffer);
        }

        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            data: newExpense
        });

    } catch (error) {
        console.error('Create Expense Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server Error'
        });
    }
};

// @desc    List expenses with pagination
// @route   GET /api/daily-expenses
// @access  Private
const listExpenses = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const query = { userId: req.user._id };

        const total = await DailyExpense.countDocuments(query);
        const expenses = await DailyExpense.find(query)
            .populate('party', 'companyName')
            .populate('staff', 'fullName')
            .sort({ expenseDate: -1, createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            count: expenses.length,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            data: expenses
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Search expenses with filters
// @route   GET /api/daily-expenses/search
// @access  Private
const searchExpenses = async (req, res) => {
    try {
        const query = await buildExpenseQuery(req.user._id, req.query);

        const expenses = await DailyExpense.find(query)
            .populate('party', 'companyName')
            .populate('staff', 'fullName')
            .sort({ expenseDate: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            count: expenses.length,
            data: expenses
        });
    } catch (error) {
        console.error('Search Expenses Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// @desc    Get expense summary
// @route   GET /api/daily-expenses/summary
// @access  Private
const getExpenseSummary = async (req, res) => {
    try {
        const query = await buildExpenseQuery(req.user._id, req.query);

        const summary = await DailyExpense.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalTransactions: { $sum: 1 },
                    totalValue: { $sum: '$grandTotal' },
                }
            }
        ]);

        const data = summary[0] || {
            totalTransactions: 0,
            totalValue: 0
        };

        res.status(200).json({
            success: true,
            data: {
                totalTransactions: data.totalTransactions,
                totalValue: data.totalValue
            }
        });
    } catch (error) {
        console.error('Expense Summary Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server Error'
        });
    }
};

// --- Custom Field Handlers ---
const getCustomFields = async (req, res) => {
    try {
        const fields = await DailyExpenseCustomField.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: fields });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const createCustomField = async (req, res) => {
    try {
        const { name, type, options, required, print, orderNo } = req.body;
        const newField = new DailyExpenseCustomField({
            userId: req.user._id,
            name,
            type,
            options,
            required,
            print,
            orderNo
        });
        await newField.save();
        res.status(201).json({ success: true, message: 'Custom field created', data: newField });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const updateCustomField = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await DailyExpenseCustomField.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'Field not found' });
        res.status(200).json({ success: true, message: 'Custom field updated', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const deleteCustomField = async (req, res) => {
    try {
        const { id } = req.params;
        await DailyExpenseCustomField.findOneAndDelete({ _id: id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Custom field deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// --- Item Column Handlers ---
const getItemColumns = async (req, res) => {
    try {
        const columns = await DailyExpenseItemColumn.find({ userId: req.user._id }).sort({ orderNo: 1 });
        res.status(200).json({ success: true, data: columns });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const createItemColumn = async (req, res) => {
    try {
        const { name, type, options, orderNo } = req.body;
        const newColumn = new DailyExpenseItemColumn({
            userId: req.user._id,
            name,
            type,
            options,
            orderNo
        });
        await newColumn.save();
        res.status(201).json({ success: true, message: 'Item column created', data: newColumn });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Print Single or Multiple Expenses
// @route   GET /api/daily-expenses/:id/print
const printExpense = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids }, userId: req.user._id }).populate('party');
        if (!expenses || expenses.length === 0) return res.status(404).json({ success: false, message: 'Not found' });

        const user = await User.findById(req.user._id);
        const allPdfData = await Promise.all(expenses.map(exp => mapExpenseToPDFData(exp, req.user._id)));
        const options = getCopyOptions(req);

        const pdfBuffer = await generateDailyExpensePDF(allPdfData, user, options);

        res.setHeader('Content-Type', 'application/pdf');
        const filename = expenses.length === 1 ? `expense-${expenses[0].expenseNo}.pdf` : 'expenses-merged.pdf';
        res.setHeader('Content-Disposition', `inline; filename=${filename}`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Print Expense Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const updateItemColumn = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await DailyExpenseItemColumn.findOneAndUpdate(
            { _id: id, userId: req.user._id },
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ success: false, message: 'Column not found' });
        res.status(200).json({ success: true, message: 'Item column updated', data: updated });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const deleteItemColumn = async (req, res) => {
    try {
        const { id } = req.params;
        await DailyExpenseItemColumn.findOneAndDelete({ _id: id, userId: req.user._id });
        res.status(200).json({ success: true, message: 'Item column deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Import expenses from Excel
// @route   POST /api/daily-expenses/import
// @access  Private
const importExpenses = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload an Excel file' });
    }

    // Create initial import log
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
            importLog.errorLogs.push({ error: 'Excel sheet is empty or only contains headers' });
            await importLog.save();
            return res.status(400).json({ success: false, message: 'Excel sheet is empty or only contains headers' });
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

        const expensesMap = new Map(); // Group by expenseNo
        const results = {
            totalRows: 0,
            imported: 0,
            failed: 0,
            errors: []
        };

        const customFieldDefs = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active' });

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const rawExpenseNo = getVal(row, 'expenseNo');
            const expenseNo = rawExpenseNo?.toString().trim();

            if (!expenseNo) return;

            results.totalRows++;

            if (!expensesMap.has(expenseNo)) {
                const rawDate = getVal(row, 'expenseDate');
                const isGst = getVal(row, 'isGstBill');

                expensesMap.set(expenseNo, {
                    expenseNo,
                    expenseDate: rawDate,
                    category: getVal(row, 'category')?.toString(),
                    isGstBill: isGst === 'true' || isGst === true || isGst === 1,
                    partyName: getVal(row, 'party')?.toString().trim(),
                    staffName: getVal(row, 'staffName')?.toString().trim(),
                    paymentType: getVal(row, 'paymentType')?.toString().toUpperCase(),
                    remarks: getVal(row, 'remarks')?.toString() || getVal(row, 'title')?.toString(),
                    description: getVal(row, 'description')?.toString(),
                    roundOff: Number(getVal(row, 'roundOff')) || 0,
                    amountInWords: getVal(row, 'amountInWords')?.toString(),
                    customFields: {},
                    items: [],
                    rowIndex: rowNumber
                });

                customFieldDefs.forEach(def => {
                    const header = `cf_${def._id}`;
                    const val = getVal(row, header);
                    if (val !== null && val !== undefined) {
                        expensesMap.get(expenseNo).customFields[def._id.toString()] = val;
                    }
                });
            }

            const itemName = getVal(row, 'item_name') || getVal(row, 'name');
            if (itemName) {
                expensesMap.get(expenseNo).items.push({
                    name: itemName.toString(),
                    note: getVal(row, 'item_note')?.toString() || getVal(row, 'note')?.toString(),
                    quantity: Number(getVal(row, 'quantity')) || 1,
                    price: Number(getVal(row, 'price')) || 0,
                });
            }
        });

        for (const [expenseNo, data] of expensesMap.entries()) {
            try {
                if (data.items.length === 0) {
                    throw new Error(`Expense ${expenseNo} has no items`);
                }

                const existing = await DailyExpense.findOne({ userId: req.user._id, expenseNo });
                if (existing) throw new Error(`Duplicate expenseNo: ${expenseNo}`);

                if (data.partyName) {
                    const vendor = await Vendor.findOne({ userId: req.user._id, companyName: { $regex: new RegExp(`^${data.partyName}$`, 'i') } });
                    if (vendor) data.party = vendor._id;
                }

                if (data.staffName) {
                    const staff = await Staff.findOne({ ownerRef: req.user._id, fullName: { $regex: new RegExp(`^${data.staffName}$`, 'i') } });
                    if (staff) data.staff = staff._id;
                }

                if (!['CASH', 'CHEQUE', 'ONLINE', 'BANK'].includes(data.paymentType)) {
                    data.paymentType = 'CASH';
                }

                let calculatedGrandTotal = 0;
                let calculatedTotalTaxable = 0;
                const finalItems = data.items.map(item => {
                    const amount = item.quantity * item.price;
                    calculatedGrandTotal += amount;
                    calculatedTotalTaxable += amount;
                    return { ...item, amount };
                });

                const finalGrandTotal = calculatedGrandTotal + data.roundOff;

                const newExpense = new DailyExpense({
                    userId: req.user._id,
                    expenseNo: data.expenseNo,
                    expenseDate: data.expenseDate ? new Date(data.expenseDate) : new Date(),
                    category: data.category || 'General',
                    isGstBill: data.isGstBill,
                    party: data.party || null,
                    staff: data.staff || null,
                    paymentType: data.paymentType,
                    remarks: data.remarks || '',
                    description: data.description || data.remarks || '',
                    items: finalItems,
                    roundOff: data.roundOff,
                    grandTotal: finalGrandTotal,
                    totalTaxable: calculatedTotalTaxable,
                    amountInWords: data.amountInWords,
                    customFields: data.customFields,
                    importId: importLog._id
                });

                await newExpense.save();
                results.imported++;
            } catch (err) {
                results.failed++;
                const errObj = { expenseNo, row: data.rowIndex, error: err.message };
                results.errors.push(errObj);
                importLog.errorLogs.push(errObj);
            }
        }

        importLog.totalRows = results.totalRows;
        importLog.importedCount = results.imported;
        importLog.failedCount = results.failed;
        importLog.status = 'Completed';
        await importLog.save();

        res.status(200).json({
            success: true,
            message: `Import completed. ${results.imported} imported, ${results.failed} failed.`,
            results
        });

    } catch (error) {
        console.error('Import Error:', error);
        importLog.status = 'Failed';
        importLog.errorLogs.push({ error: error.message });
        await importLog.save();
        res.status(500).json({ success: false, message: 'Error processing Excel file', error: error.message });
    }
};

// @desc    Get import history
// @route   GET /api/daily-expenses/import-history
// @access  Private
const getImportHistory = async (req, res) => {
    try {
        const history = await DailyExpenseImport.find({ userId: req.user._id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Attach file to expense
// @route   POST /api/daily-expenses/attach-file
// @access  Private
const attachFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { expenseId } = req.body;
        const fs = require('fs');
        const attachmentUrl = req.file.path; // Or cloud URL if using S3/etc later

        let expense;

        if (expenseId) {
            // --- UPDATE EXISTING ---
            expense = await DailyExpense.findOne({ _id: expenseId, userId: req.user._id });
            if (!expense) {
                // Cleanup uploaded file since orphaned
                if (fs.existsSync(attachmentUrl)) fs.unlinkSync(attachmentUrl);
                return res.status(404).json({ success: false, message: 'Expense not found' });
            }

            // Cleanup old attachment if replacing
            if (expense.attachment && expense.attachment !== attachmentUrl) {
                if (fs.existsSync(expense.attachment)) {
                    try {
                        fs.unlinkSync(expense.attachment);
                    } catch (err) {
                        console.error("Error deleting old attachment:", err);
                    }
                }
            }

            expense.attachment = attachmentUrl;
        } else {
            // --- CREATE NEW (Auto-Generate) ---
            // Create a placeholder expense record so the file has a home
            expense = new DailyExpense({
                userId: req.user._id,
                // Generate a unique temp number. User can edit later.
                expenseNo: `AUTO-${Date.now()}`,
                expenseDate: new Date(),
                category: 'General', // Default required category
                paymentType: 'CASH', // Default required payment type
                attachment: attachmentUrl,
                items: [], // Empty items allowed
                grandTotal: 0
            });
        }

        await expense.save();

        res.status(200).json({
            success: true,
            message: expenseId ? 'File attached successfully' : 'New expense created with attachment',
            data: {
                expenseId: expense._id,
                attachment: attachmentUrl,
                fileName: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            }
        });

    } catch (error) {
        console.error('Attach File Error:', error);
        // Attempt cleanup on server error
        if (req.file && require('fs').existsSync(req.file.path)) {
            try { require('fs').unlinkSync(req.file.path); } catch (e) { }
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete attachment
// @route   DELETE /api/daily-expenses/attachment/:id
// @access  Private
const deleteAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await DailyExpense.findOne({ _id: id, userId: req.user._id });

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        if (expense.attachment) {
            const fs = require('fs');
            if (fs.existsSync(expense.attachment)) {
                try {
                    fs.unlinkSync(expense.attachment);
                } catch (err) {
                    console.error("Error deleting attachment:", err);
                }
            }
            expense.attachment = '';
            await expense.save();
        }

        res.status(200).json({ success: true, message: 'Attachment deleted successfully', data: expense.attachment });
    } catch (error) {
        console.error('Delete Attachment Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get attachment details
// @route   GET /api/daily-expenses/attachment/:id
// @access  Private
const getAttachment = async (req, res) => {
    try {
        const { id } = req.params;
        const expense = await DailyExpense.findOne({ _id: id, userId: req.user._id });

        if (!expense) {
            return res.status(404).json({ success: false, message: 'Expense not found' });
        }

        if (!expense.attachment) {
            return res.status(404).json({ success: false, message: 'No attachment found' });
        }

        const path = require('path');
        const fileName = path.basename(expense.attachment);

        res.status(200).json({
            success: true,
            data: {
                attachment: expense.attachment,
                fileName: fileName,
                // Simple mime type derivation for response consistency
                mimetype: fileName.endsWith('.pdf') ? 'application/pdf' :
                    (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) ? 'image/jpeg' :
                        fileName.endsWith('.png') ? 'image/png' : 'application/octet-stream'
            }
        });

    } catch (error) {
        console.error('Get Attachment Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// --- PDF PDF & SHARING HELPERS ---
const { generateDailyExpensePDF } = require('../../utils/dailyExpensePdfHelper');
const { sendEmail } = require('../../utils/emailHelper'); // Assumption: reusable or need create
const User = require('../../models/User-Model/User');

const getCopyOptions = (req) => {
    const { original, duplicate, transport, office } = req.method === 'GET' ? req.query : req.body;
    return {
        original: original === 'true' || original === true,
        duplicate: duplicate === 'true' || duplicate === true,
        transport: transport === 'true' || transport === true,
        office: office === 'true' || office === true
    };
};

const generatePublicToken = (id) => {
    return crypto.createHmac('sha256', process.env.JWT_SECRET || 'secret').update(id.toString()).digest('hex').substring(0, 16);
};

const mapExpenseToPDFData_Deprecated = (expense) => {
    // Determine Vendor/Party Details
    // If expense.party is populated, use it. Else if basic details are there.
    // Ideally party should be populated.

    // Vendor Details
    const vendorDetails = {
        name: expense.party ? expense.party.name : (expense.customFields?.vendorName || "-"),
        category: expense.category,
        paymentType: expense.paymentType,
        gstin: expense.party ? expense.party.gstin : "-",
        state: expense.party ? expense.party.state : "-",
        address: expense.party ? expense.party.address : "-"
    };

    // Item Mapping
    const items = expense.items.map(item => {
        // Calculate tax amount per item if not explicitly stored
        // item structure: { name, note, quantity, price, amount }
        // The detailed structure (taxable, igst etc) might be in item or calculated. 
        // Based on DailyExpense Schema, we have: items: [{ name, quantity, price, amount, note }]
        // But schema might have been updated or we assume basic calc.
        // User request "taxable value, IGST/Cess/Total" implies these exist or need calculation.
        // DailyExpense usually is simple. If items don't have tax fields, we assume inclusive or 0? 
        // Existing `resolve-item` logic suggests we do have tax info available in frontend, 
        // but does DailyExpense `items` array store it? 
        // Let's assume standard fields or calculate. For now, simple mapping.

        const qty = Number(item.quantity) || 0;
        const rate = Number(item.price) || 0;
        const total = Number(item.amount) || 0;
        // Back-calculate taxable if not present (Assuming 0 tax if not stored)
        // If tax fields are missing in DB items, we show 0.

        return {
            name: item.name,
            qty: qty,
            rate: rate,
            discount: 0, // Field might not exist in simple expense
            taxable: total, // Simplified if no tax info
            tax: 0,
            total: total
        };
    });

    return {
        expenseDetails: {
            no: expense.expenseNo,
            date: expense.expenseDate
        },
        vendorDetails,
        items,
        totals: {
            grandTotal: expense.grandTotal,
            totalInWords: expense.amountInWords || "",
            currency: 'Rs.'
        },
        remarks: expense.remarks,
        status: 'ACTIVE' // Expenses don't usually have CANCELLED status in this system yet
    };
};

const mapExpenseToPDFData = async (expense, userId) => {
    // Vendor Details
    const vendorDetails = {
        name: expense.party ? expense.party.name : (expense.customFields ? expense.customFields.get('vendorName') || "-" : "-"),
        category: expense.category,
        paymentType: expense.paymentType,
        gstin: expense.party ? expense.party.gstin : "-",
        state: expense.party ? expense.party.state : (expense.customFields ? expense.customFields.get('placeOfSupply') || "-" : "-"),
        address: expense.party ? expense.party.address : "-",
        phone: expense.party ? expense.party.phone : "-"
    };

    let totalQty = 0;
    let totalDisc = 0;
    let totalTaxable = 0;
    let totalIgst = 0;
    let totalCess = 0;

    // Item Mapping
    const items = expense.items.map(item => {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.price) || 0;
        const amount = Number(item.amount) || 0;

        const disc = 0;
        const taxable = amount;
        const igstPer = 0;
        const igstAmt = 0;
        const cess = 0;

        totalQty += qty;
        totalDisc += disc;
        totalTaxable += taxable;
        totalIgst += igstAmt;
        totalCess += cess;

        return {
            name: item.name,
            qty: qty,
            rate: rate,
            discount: disc,
            taxable: taxable,
            igstPer: igstPer,
            igstAmt: igstAmt,
            cess: cess,
            total: amount
        };
    });

    // Custom Fields (Printable)
    const definitions = await DailyExpenseCustomField.find({ userId, status: 'Active', print: true });
    const printableFields = definitions
        .filter(def => expense.customFields && expense.customFields.get && expense.customFields.get(def._id.toString()))
        .map(def => ({ name: def.name, value: expense.customFields.get(def._id.toString()) }));

    return {
        expenseDetails: {
            no: expense.expenseNo,
            date: expense.expenseDate
        },
        vendorDetails,
        items,
        totals: {
            totalQty,
            totalDisc,
            totalTaxable,
            totalIgst,
            totalCess,
            grandTotal: expense.grandTotal,
            totalInWords: expense.amountInWords || "",
            currency: 'Rs.'
        },
        customFields: printableFields,
        remarks: expense.remarks,
        status: 'ACTIVE'
    };
};

// @desc    Download Expense PDF (Single or Merged)
// @route   GET /api/daily-expenses/:id/download-pdf
const downloadExpensePDF = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids }, userId: req.user._id }).populate('party');
        if (!expenses || expenses.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

        const user = await User.findById(req.user._id);
        const allPdfData = await Promise.all(expenses.map(exp => mapExpenseToPDFData(exp, req.user._id)));
        const options = getCopyOptions(req);

        const pdfBuffer = await generateDailyExpensePDF(allPdfData, user, options);

        const filename = expenses.length === 1 ? `Expense_${expenses[0].expenseNo}.pdf` : 'Expenses_Merged.pdf';
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

// @desc    Share Expense via Email (Single or Merged)
// @route   POST /api/daily-expenses/:id/share-email
const shareExpenseEmail = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const ids = req.params.id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids }, userId: req.user._id }).populate('party');
        if (!expenses || expenses.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

        const user = await User.findById(req.user._id);
        const allPdfData = await Promise.all(expenses.map(exp => mapExpenseToPDFData(exp, req.user._id)));
        const options = getCopyOptions(req);
        const pdfBuffer = await generateDailyExpensePDF(allPdfData, user, options);

        const filename = expenses.length === 1 ? `Expense_${expenses[0].expenseNo}.pdf` : 'Expenses_Merged.pdf';
        const subject = expenses.length === 1 ? `Expense Voucher - ${expenses[0].expenseNo}` : 'Merged Expense Vouchers';

        await sendEmail({
            to: email,
            subject: subject,
            text: `Please find attached the expense voucher(s).`,
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

// @desc    Share Expense via WhatsApp
// @desc    Share Expense via WhatsApp (Single or Merged)
// @route   POST /api/daily-expenses/:id/share-whatsapp
const shareExpenseWhatsApp = async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile) return res.status(400).json({ success: false, message: 'Mobile number is required' });

        const ids = req.params.id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids }, userId: req.user._id });
        if (!expenses || expenses.length === 0) return res.status(404).json({ success: false, message: 'Expense not found' });

        // Generate a public link
        const options = getCopyOptions(req);
        let queryParams = [];
        if (options.original) queryParams.push('original=true');
        if (options.duplicate) queryParams.push('duplicate=true');
        if (options.transport) queryParams.push('transport=true');
        if (options.office) queryParams.push('office=true');

        const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
        const link = `${req.protocol}://${req.get('host')}/api/daily-expenses/view-public/${req.params.id}/${generatePublicToken(req.params.id)}${queryString}`;

        const message = expenses.length === 1
            ? `Expense Voucher: ${expenses[0].expenseNo}\nDate: ${new Date(expenses[0].expenseDate).toLocaleDateString()}\nAmount: ${expenses[0].grandTotal}\nView Link: ${link}`
            : `Multiple Expense Vouchers (${expenses.length})\nView Merged Link: ${link}`;

        const waLink = `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`;

        res.status(200).json({ success: true, message: 'WhatsApp link generated', data: { link: waLink } });
    } catch (error) {
        console.error('Share WhatsApp Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Generate a secure public link for the expense (Single or Merged)
// @route   GET /api/daily-expenses/:id/public-link
const generatePublicLink = async (req, res) => {
    try {
        const ids = req.params.id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids }, userId: req.user._id });
        if (!expenses || expenses.length === 0) return res.status(404).json({ success: false, message: "Expense not found" });

        const token = generatePublicToken(req.params.id);
        const baseUrl = `${req.protocol}://${req.get('host')}`;
        const publicLink = `${baseUrl}/api/daily-expenses/view-public/${req.params.id}/${token}`;

        res.status(200).json({ success: true, publicLink });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Public View Expense PDF (Single or Merged)
// @route   GET /api/daily-expenses/view-public/:id/:token
const viewExpensePublic = async (req, res) => {
    try {
        const { id, token } = req.params;
        const expectedToken = generatePublicToken(id);

        if (token !== expectedToken) {
            return res.status(401).send("Invalid or expired link");
        }

        const ids = id.split(',');
        const expenses = await DailyExpense.find({ _id: { $in: ids } }).populate('party');
        if (!expenses || expenses.length === 0) return res.status(404).send("Expense not found");

        // Use the userId from the first expense found
        const userId = expenses[0].userId;
        const user = await User.findById(userId);
        const allPdfData = await Promise.all(expenses.map(exp => mapExpenseToPDFData(exp, userId)));
        const options = getCopyOptions(req);
        const pdfBuffer = await generateDailyExpensePDF(allPdfData, user || {}, options);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="Expenses.pdf"');
        res.status(200).send(pdfBuffer);
    } catch (error) {
        console.error('View Public Error:', error);
        res.status(500).send("Error rendering expense");
    }
};

module.exports = {
    createExpense,
    listExpenses,
    searchExpenses,
    getExpenseSummary,
    getCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    getItemColumns,
    createItemColumn,
    updateItemColumn,
    deleteItemColumn,
    importExpenses,
    getImportHistory,
    printExpense,
    attachFile,
    deleteAttachment,
    getAttachment,
    downloadExpensePDF,
    shareExpenseEmail,
    shareExpenseWhatsApp,
    generatePublicLink,
    viewExpensePublic
};
