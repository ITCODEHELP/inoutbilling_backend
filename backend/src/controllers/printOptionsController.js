const PrintOptions = require('../models/PrintOptions');

/**
 * @desc    Save or Update print options (smart merge - only updates provided fields)
 * @route   POST /api/print-options
 * @access  Private (JWT Protected)
 */
const savePrintOptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const providedSettings = req.body;

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

module.exports = {
    savePrintOptions
};
