const Customer = require('../models/Customer');
const ExcelJS = require('exceljs');

// @desc    Create new customer/vendor
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
    try {
        const {
            companyName,
            companyType,
            gstin,
            pan,
            contactPerson,
            contactNo,
            email,
            website,
            registrationType,
            billingAddress,
            shippingAddress,
            bankDetails,
            openingBalance,
            additionalDetails
        } = req.body;

        const customer = await Customer.create({
            userId: req.user._id,
            companyName,
            companyType,
            gstin,
            pan,
            contactPerson,
            contactNo,
            email,
            website,
            registrationType,
            billingAddress,
            shippingAddress,
            bankDetails,
            openingBalance,
            additionalDetails
        });

        res.status(201).json(customer);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get all customers
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
    try {
        const customers = await Customer.find({ userId: req.user._id });
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.status(200).json(customer);
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedCustomer);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private
const deleteCustomer = async (req, res) => {
    try {
        const customer = await Customer.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.status(200).json({ message: 'Customer removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

// @desc    Download dummy customers Excel file
// @route   GET /api/customers/download-customers
// @access  Public
const downloadCustomers = async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Customers');

        // Define columns based on user request
        worksheet.columns = [
            { header: 'CUSTOMER / VENDOR NAME', key: 'name', width: 25 },
            { header: 'CONTACT PERSON', key: 'contactPerson', width: 20 },
            { header: 'CONTACT NO', key: 'contactNo', width: 15 },
            { header: 'ADDRESS 1', key: 'address1', width: 30 },
            { header: 'ADDRESS 2', key: 'address2', width: 20 },
            { header: 'LANDMARK', key: 'landmark', width: 15 },
            { header: 'COUNTRY', key: 'country', width: 15 },
            { header: 'STATE', key: 'state', width: 15 },
            { header: 'CITY', key: 'city', width: 15 },
            { header: 'COMPANY TYPE', key: 'companyType', width: 15 },
            { header: 'BANK NAME', key: 'bankName', width: 20 },
            { header: 'BANK IFSC CODE', key: 'ifscCode', width: 15 },
            { header: 'BANK ACCOUNT NUMBER', key: 'accountNumber', width: 20 },
            { header: 'PINCODE', key: 'pincode', width: 10 },
            { header: 'FAX NO', key: 'faxNo', width: 15 },
            { header: 'WEBSITE', key: 'website', width: 25 },
            { header: 'EMAIL', key: 'email', width: 25 },
            { header: 'Registration Type', key: 'regType', width: 15 },
            { header: 'GSTIN', key: 'gstin', width: 20 },
            { header: 'PAN', key: 'pan', width: 15 },
            { header: 'DISTANCE FOR E-WAY BILL (IN KM)', key: 'distance', width: 15 },
            { header: 'Custom Field 1', key: 'custom1', width: 15 },
            { header: 'Custom Field 2', key: 'custom2', width: 15 },
            { header: 'Custom Field 3', key: 'custom3', width: 15 },
            { header: 'Due Days', key: 'dueDays', width: 10 },
            { header: 'NOTE', key: 'note', width: 20 },
            { header: 'Customer Balance Type', key: 'custBalType', width: 15 },
            { header: 'Customer Balance Amount', key: 'custBalAmt', width: 15 },
            { header: 'Vendor Balance Type', key: 'vendBalType', width: 15 },
            { header: 'Vendor Balance Amount', key: 'vendBalAmt', width: 15 }
        ];

        // dummy rows
        worksheet.addRows([
            {
                name: 'Alpha Traders',
                contactPerson: 'Rajesh Kumar',
                contactNo: '9876543210',
                address1: 'Shop No 4, Market Road',
                address2: 'Near Bus Stand',
                landmark: 'City Center',
                country: 'India',
                state: 'Maharashtra',
                city: 'Pune',
                companyType: 'Retail',
                bankName: 'HDFC',
                ifscCode: 'HDFC0001234',
                accountNumber: '50100123456789',
                pincode: '411001',
                faxNo: '',
                website: 'www.alphatraders.com',
                email: 'rajesh@alphatraders.com',
                regType: 'Regular',
                gstin: '27ABCDE1234F1Z5',
                pan: 'ABCDE1234F',
                distance: '15',
                custom1: '',
                custom2: '',
                custom3: '',
                dueDays: '30',
                note: 'Priority Customer',
                custBalType: 'Credit',
                custBalAmt: '5000',
                vendBalType: '',
                vendBalAmt: '0'
            },
            {
                name: 'Beta Suppliers',
                contactPerson: 'Amit Low',
                contactNo: '8765432109',
                address1: 'Plot 45, Industrial Area',
                address2: 'Phase 2',
                landmark: 'Metro Stn',
                country: 'India',
                state: 'Delhi',
                city: 'New Delhi',
                companyType: 'Wholesale',
                bankName: 'SBI',
                ifscCode: 'SBIN0004567',
                accountNumber: '30987654321',
                pincode: '110020',
                faxNo: '011-2345678',
                website: 'www.betasuppliers.in',
                email: 'info@betasuppliers.in',
                regType: 'Composition',
                gstin: '07FGHIJ5678K1Z2',
                pan: 'FGHIJ5678K',
                distance: '250',
                custom1: 'Region-North',
                custom2: '',
                custom3: '',
                dueDays: '45',
                note: '',
                custBalType: '',
                custBalAmt: '0',
                vendBalType: 'Debit',
                vendBalAmt: '12000'
            },
            {
                name: 'Gamma Services',
                contactPerson: 'Sneha Gupta',
                contactNo: '9988776655',
                address1: 'Office 12, Tech Park',
                address2: '',
                landmark: 'IT Zone',
                country: 'India',
                state: 'Karnataka',
                city: 'Bangalore',
                companyType: 'Service',
                bankName: 'ICICI',
                ifscCode: 'ICIC0007890',
                accountNumber: '123456789012',
                pincode: '560100',
                faxNo: '',
                website: '',
                email: 'sneha@gamma.com',
                regType: 'Unregistered',
                gstin: '',
                pan: 'PQRST9012U',
                distance: '10',
                custom1: '',
                custom2: '',
                custom3: '',
                dueDays: '15',
                note: 'Check TDS',
                custBalType: 'Credit',
                custBalAmt: '2500',
                vendBalType: '',
                vendBalAmt: '0'
            }
        ]);

        // Style header
        worksheet.getRow(1).eachCell((cell) => {
            cell.font = { bold: true };
        });

        // Set response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=customers.xlsx'
        );

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating file', error: error.message });
    }
};

module.exports = {
    downloadCustomers,
    createCustomer,
    getCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
};
