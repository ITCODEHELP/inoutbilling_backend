const Business = require('../../models/Login-Model/Business');
const User = require('../../models/User-Model/User');
const axios = require('axios');

// @desc    GST Auto Fill
// @route   GET /api/public/gst-autofill/:gstin
const gstAutoFill = async (req, res) => {
    try {
        const { gstin } = req.params;

        // Requirement: Call GST API and map response
        // Using Mock/Simulation as verified provider is not configured yet, but structure will match.
        // In production, replace with: `await axios.get('PROVIDER_URL/${gstin}')`

        const mockResponse = {
            "status": "OK",
            "gstno": gstin,
            "gstapicall_data": {
                "name": "MOCK COMPANY PVT LTD", // Example Data
                "address1": "123, EXAMPLE TOWER",
                "city": "SURAT",
                "state": "GUJARAT",
                "pincode": "395006"
            },
            "cmpExist": []
        };

        return res.status(200).json(mockResponse);

    } catch (error) {
        console.error('GST Auto Fill Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
};

// @desc    Add Business (Compulsory Onboarding)
// @route   POST /api/business/add
const addBusiness = async (req, res) => {
    try {
        const { haveGstin, gstin, companyName, fullName, email, address, address2, city, state, pincode } = req.body;

        // userId from protected route (token)
        const userId = req.user ? req.user.userId : null;

        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Validate required fields (excluding userId from body)
        if (!companyName || !fullName || !address || !city || !state || !pincode) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Validate GSTIN if haveGstin is true
        if (haveGstin === true && !gstin) {
            return res.status(400).json({ message: 'GSTIN is required when selected Yes' });
        }

        const newBusiness = await Business.create({
            userId,
            haveGstin,
            gstin: haveGstin ? gstin : null, // Ensure null if no GSTIN
            companyName,
            fullName,
            email,
            address,
            address2,
            city,
            state,
            pincode
        });

        // Link business company name to User for dashboard display
        await User.findOneAndUpdate({ userId }, {
            companyName: companyName,
            gstNumber: haveGstin ? gstin : null
        });

        res.status(201).json({
            message: 'Business added successfully',
            business: newBusiness
        });

    } catch (error) {
        console.error('Add Business Error:', error);
        res.status(500).json({ message: 'Server Error', error: error.message });
    }
};

module.exports = {
    gstAutoFill,
    addBusiness
};
