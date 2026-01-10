const ProductStockSettings = require('../../models/Product-Service-Model/ProductStockSetting');

/**
 * @desc    Save or Update Product & Stock Settings
 * @route   POST /api/product-stock-settings
 * @access  Private (JWT Protected)
 */
const saveOrUpdateSettings = async (req, res) => {
    try {
        const userId = req.user._id;
        const settingsData = req.body;

        // Validate that at least some settings are provided
        if (!settingsData || Object.keys(settingsData).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Settings data is required'
            });
        }

        // Check if settings already exist for this user
        let settings = await ProductStockSettings.findOne({ userId });

        if (settings) {
            // Update existing settings
            // Merge nested objects properly
            if (settingsData.productOptions) {
                settings.productOptions = {
                    ...settings.productOptions.toObject(),
                    ...settingsData.productOptions
                };
            }
            if (settingsData.stockOptions) {
                settings.stockOptions = {
                    ...settings.stockOptions.toObject(),
                    ...settingsData.stockOptions
                };
            }
            if (settingsData.serialNumberSettings) {
                settings.serialNumberSettings = {
                    ...settings.serialNumberSettings.toObject(),
                    ...settingsData.serialNumberSettings,
                    applicableDocuments: {
                        ...settings.serialNumberSettings.applicableDocuments.toObject(),
                        ...(settingsData.serialNumberSettings.applicableDocuments || {})
                    }
                };
            }
            if (settingsData.batchSettings) {
                settings.batchSettings = {
                    ...settings.batchSettings.toObject(),
                    ...settingsData.batchSettings
                };
            }
            if (settingsData.batchOptionsForDocuments) {
                settings.batchOptionsForDocuments = {
                    ...settings.batchOptionsForDocuments.toObject(),
                    ...settingsData.batchOptionsForDocuments
                };
            }
            if (settingsData.barcodeOptions) {
                settings.barcodeOptions = {
                    ...settings.barcodeOptions.toObject(),
                    ...settingsData.barcodeOptions
                };
            }

            await settings.save();

            return res.status(200).json({
                success: true,
                message: 'Product & Stock settings updated successfully',
                data: settings
            });
        } else {
            // Create new settings
            settings = await ProductStockSettings.create({
                userId,
                ...settingsData
            });

            return res.status(201).json({
                success: true,
                message: 'Product & Stock settings saved successfully',
                data: settings
            });
        }
    } catch (error) {
        console.error('Error saving/updating Product & Stock settings:', error);

        // Handle validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors
            });
        }

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Settings already exist for this user'
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Failed to save/update settings',
            error: error.message
        });
    }
};

/**
 * @desc    Get Product & Stock Settings for logged-in user
 * @route   GET /api/product-stock-settings
 * @access  Private (JWT Protected)
 */
const getSettings = async (req, res) => {
    try {
        const userId = req.user._id;

        const settings = await ProductStockSettings.findOne({ userId });

        if (!settings) {
            // Return default settings structure if none exist
            return res.status(200).json({
                success: true,
                message: 'No settings found, returning defaults',
                data: {
                    productOptions: {
                        mrp: { status: true, required: false, print: true, allowDuplicate: true },
                        productCode: { status: true, required: false, print: true, allowDuplicate: false },
                        barcodeNo: { status: true, required: false, print: true, allowDuplicate: false },
                        enableSearchByAnyWord: true
                    },
                    stockOptions: {
                        allowSalesWithoutStock: false,
                        hideOutOfStockProducts: false,
                        hideOutOfStockBatches: false
                    },
                    serialNumberSettings: {
                        fieldName: 'Serial Number',
                        strictMode: false,
                        applicableDocuments: {
                            quotation: false,
                            proformaInvoice: false,
                            saleOrder: false,
                            deliveryChallan: false
                        }
                    },
                    batchSettings: {
                        batchNo: { type: 'text', status: true, required: false, print: true, inputOption: 'text' },
                        modelNo: { type: 'text', status: false, required: false, print: false, inputOption: 'text' },
                        size: { type: 'text', status: false, required: false, print: false, inputOption: 'text' },
                        mfgDate: { type: 'date', status: false, required: false, print: false, inputOption: 'date' },
                        expiryDate: { type: 'date', status: false, required: false, print: false, inputOption: 'date' }
                    },
                    batchOptionsForDocuments: {
                        quotation: false,
                        proformaInvoice: false,
                        deliveryChallan: false,
                        purchaseOrder: false,
                        saleOrder: false,
                        jobWork: false
                    },
                    barcodeOptions: {
                        minimumBarcodeScanLength: 3,
                        focusAfterScan: 'quantity',
                        alwaysAddNewRowOnScan: false
                    }
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Settings retrieved successfully',
            data: settings
        });
    } catch (error) {
        console.error('Error fetching Product & Stock settings:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch settings',
            error: error.message
        });
    }
};

module.exports = {
    saveOrUpdateSettings,
    getSettings
};
