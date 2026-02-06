const DocumentOption = require('../../models/Setting-Model/DocumentOption');

/**
 * @desc    Get Document Options
 * @route   GET /api/document-options
 * @access  Private
 */
exports.getDocumentOptions = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;

        const options = await DocumentOption.findOne({ userId });

        if (!options) {
            return res.status(200).json({
                userId,
                saleInvoice: {},
                // We let the frontend handle empty states or defaults
            });
        }

        res.status(200).json(options);
    } catch (error) {
        console.error('Error fetching document options:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

/**
 * @desc    Save or Update Document Options
 * @route   POST /api/document-options
 * @access  Private
 */
exports.saveDocumentOptions = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const updateData = req.body;

        // Prevent modification of userId
        delete updateData.userId;

        // Find and update or create (upsert)
        // We use findOneAndUpdate with upsert to handle race conditions better than find + save
        const options = await DocumentOption.findOneAndUpdate(
            { userId },
            { $set: updateData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            updateData,
            success: true,
            message: 'Document options saved successfully',
            data: options
        });
    } catch (error) {
        console.error('Error saving document options:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
