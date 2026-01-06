const DailyExpense = require('../models/DailyExpense');
const DailyExpenseCustomField = require('../models/DailyExpenseCustomField');
const DailyExpenseItemColumn = require('../models/DailyExpenseItemColumn');
const DailyExpenseImport = require('../models/DailyExpenseImport');
const Vendor = require('../models/Vendor');
const Staff = require('../models/Staff');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');
const { generateReceiptPDF } = require('../utils/pdfHelper');

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
            const printableFields = definitions
                .filter(def => def.print && parsedCustomFields[def._id.toString()])
                .map(def => ({ name: def.name, value: parsedCustomFields[def._id.toString()] }));

            const pdfBuffer = await generateReceiptPDF({
                no: newExpense.expenseNo,
                date: newExpense.expenseDate,
                category: newExpense.category,
                paymentType: newExpense.paymentType,
                remarks: newExpense.remarks,
                items: newExpense.items.map(i => ({ name: i.name, amount: i.amount })),
                grandTotal: newExpense.grandTotal,
                amountInWords: newExpense.amountInWords,
                customFields: printableFields
            }, "EXPENSE");

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

// @desc    Print Single Expense
// @route   GET /api/daily-expenses/:id/print
const printExpense = async (req, res) => {
    try {
        const expense = await DailyExpense.findOne({ _id: req.params.id, userId: req.user._id });
        if (!expense) return res.status(404).json({ success: false, message: 'Not found' });

        const definitions = await DailyExpenseCustomField.find({ userId: req.user._id, status: 'Active', print: true });
        const printableFields = definitions
            .filter(def => expense.customFields.get(def._id.toString()))
            .map(def => ({ name: def.name, value: expense.customFields.get(def._id.toString()) }));

        const pdfBuffer = await generateReceiptPDF({
            no: expense.expenseNo,
            date: expense.expenseDate,
            category: expense.category,
            paymentType: expense.paymentType,
            remarks: expense.remarks,
            items: expense.items.map(i => ({ name: i.name, amount: i.amount })),
            grandTotal: expense.grandTotal,
            amountInWords: expense.amountInWords,
            customFields: printableFields
        }, "EXPENSE");

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=expense-${expense.expenseNo}.pdf`);
        res.send(pdfBuffer);
    } catch (error) {
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
    printExpense
};
