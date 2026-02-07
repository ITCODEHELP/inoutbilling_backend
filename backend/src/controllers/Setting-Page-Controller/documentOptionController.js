const DocumentOption = require('../../models/Setting-Model/DocumentOption');
const { fetchAndResolveDocumentOptions, computeEffectiveConfig, mapDocTypeToSchemaKey } = require('../../utils/documentOptionsHelper');

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
 * @desc    Save or Update Document Options with Auto-Resolution
 * @route   POST /api/document-options
 * @access  Private
 */
exports.saveDocumentOptions = async (req, res) => {
    try {
        const userId = req.user.userId || req.user._id;
        const updateData = req.body;

        // Prevent modification of userId
        delete updateData.userId;

        // 1. Fetch existing options to ensure we have full context for resolution
        // (We need defaults merged with existing data + new updates)
        let docOptions = await DocumentOption.findOne({ userId });
        if (!docOptions) {
            docOptions = new DocumentOption({ userId });
        }

        // 2. Merge updates into the document (mongoose set handling)
        // We do this manually or let findOneAndUpdate handle it, 
        // BUT we need the *merged* state to compute resolvedConfig *before* final save/return.
        // So applied updates to the mongoose document instance:
        Object.keys(updateData).forEach(key => {
            if (docOptions[key] && typeof updateData[key] === 'object') {
                // If it's a known schema path (e.g. saleInvoice), merge deep?
                // Mongoose set() handles top-level schema paths well, but for nested partials 
                // we might need careful handling if updateData is partial.
                // Assuming updateData sends complete sub-objects or we want standard merge:
                // For simplicity and safety with sub-schemas, we can try Object.assign mechanism logic 
                // or just let Mongoose apply updates if we use .set().
                // However, deep merging partial 'saleInvoice' into existing 'saleInvoice' is trickier.
                // Simpler approach: Use the updateData to derive resolved config for *updated* keys.

                // Better approach: 
                // A. Update the doc from request
                docOptions.set(key, { ...docOptions[key], ...updateData[key] }); // Shallow merge at docType level
            } else {
                docOptions[key] = updateData[key];
            }
        });

        // 3. Re-Calculate Resolved Config for affected document types
        // We iterate over known standard doc types to see if they are in the update or just re-calculate all important ones.
        const docTypesToResolve = [
            'Sale Invoice', 'Delivery Challan', 'Quotation', 'Proforma', 'Purchase Order', 'Sale Order'
        ];

        docTypesToResolve.forEach(docType => {
            const schemaKey = mapDocTypeToSchemaKey(docType);

            // Only re-calculate if we have data for this type or if it was part of the update
            // (Actually, safer to just re-calc all active ones to ensure consistency)
            if (docOptions[schemaKey]) {
                const effectiveConfig = computeEffectiveConfig(docOptions[schemaKey], docType);

                // Store in the document
                if (!docOptions[schemaKey].resolvedConfig) {
                    docOptions[schemaKey].resolvedConfig = {};
                }
                docOptions[schemaKey].resolvedConfig = effectiveConfig;
            }
        });

        // 4. Save
        const savedOptions = await docOptions.save();

        res.status(200).json({
            success: true,
            message: 'Document options saved and resolved successfully',
            data: savedOptions
        });
    } catch (error) {
        console.error('Error saving document options:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};




