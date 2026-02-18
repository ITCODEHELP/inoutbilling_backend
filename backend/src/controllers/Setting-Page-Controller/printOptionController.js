const PrintOptions = require('../../models/Setting-Model/PrintOptions');

/**
 * Sanitizes boolean strings to actual booleans.
 * Handles "true"/"false", "yes"/"no", and the legacy "always".
 */
const sanitizeBooleans = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;

    Object.keys(obj).forEach(key => {
        const val = obj[key];
        if (typeof val === 'string') {
            const lowerVal = val.toLowerCase().trim();
            if (lowerVal === 'true' || lowerVal === 'yes' || lowerVal === 'always') obj[key] = true;
            else if (lowerVal === 'false' || lowerVal === 'no') obj[key] = false;
        } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            sanitizeBooleans(val);
        }
    });
    return obj;
};

/**
 * @desc    Save or Update print options (smart merge - only updates provided fields)
 * @route   POST /api/print-options
 * @access  Private (JWT Protected)
 */
const savePrintOptions = async (req, res) => {
    try {
        const userId = req.user._id;
        let providedSettings = req.body;

        // Safety conversion for booleans
        providedSettings = sanitizeBooleans(providedSettings);

        // Allow empty payload
        if (!providedSettings || typeof providedSettings !== 'object') {
            return res.status(200).json({
                success: true,
                message: 'Print options saved successfully'
            });
        }

        // Find existing settings
        let printOptions = await PrintOptions.findOne({ userId });

        if (printOptions) {
            // Smart merge: only update fields that are provided
            Object.keys(providedSettings).forEach(key => {
                if (providedSettings[key] !== undefined) {
                    // Deep merge for nested objects
                    if (typeof providedSettings[key] === 'object' && providedSettings[key] !== null && !Array.isArray(providedSettings[key])) {
                        printOptions[key] = {
                            ...(printOptions[key] || {}),
                            ...providedSettings[key]
                        };
                    } else {
                        // Direct assignment for primitives, arrays, or null
                        printOptions[key] = providedSettings[key];
                    }
                }
            });

            // Mark modified for Mixed type fields
            printOptions.markModified('headerPrintSettings');
            printOptions.markModified('customerDocumentPrintSettings');
            printOptions.markModified('productItemSettings');
            printOptions.markModified('footerPrintSettings');
            printOptions.markModified('documentPrintSettings');
            printOptions.markModified('packingListPrintSettings');
            printOptions.markModified('otherSettings');

            await printOptions.save();
        } else {
            // Create new settings with provided values
            printOptions = await PrintOptions.create({
                userId,
                ...providedSettings
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Print options saved successfully'
        });
    } catch (error) {
        console.error('Error saving print options:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to save print options',
            error: error.message
        });
    }
};

/**
 * @desc    Get print options for the authenticated user
 * @route   GET /api/print-options
 * @access  Private (JWT Protected)
 */
const getPrintOptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const printOptions = await PrintOptions.findOne({ userId });

        if (!printOptions) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No print options found'
            });
        }

        return res.status(200).json({
            success: true,
            data: printOptions
        });
    } catch (error) {
        console.error('Error fetching print options:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch print options',
            error: error.message
        });
    }
};

module.exports = {
    savePrintOptions,
    getPrintOptions
};
