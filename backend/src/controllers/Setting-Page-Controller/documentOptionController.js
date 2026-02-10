const DocumentOption = require('../../models/Setting-Model/DocumentOption');
const { fetchAndResolveDocumentOptions, computeEffectiveConfig, mapDocTypeToSchemaKey } = require('../../utils/documentOptionsHelper');

/**
 * @desc    Get document options for a user
 * @route   GET /api/document-options
 * @access  Private
 */
const getDocumentOptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const { docType, seriesName } = req.query;

        // If specific docType requested, return resolved config for that type
        if (docType) {
            const resolvedConfig = await fetchAndResolveDocumentOptions(userId, docType, seriesName);
            return res.status(200).json({
                success: true,
                data: resolvedConfig
            });
        }

        // Otherwise return all document options
        let docOptions = await DocumentOption.findOne({ userId });

        // Create default if not exists
        if (!docOptions) {
            docOptions = await DocumentOption.create({ userId });
        }

        res.status(200).json({
            success: true,
            data: docOptions
        });

    } catch (error) {
        console.error('[DocumentOptionController] Error fetching document options:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch document options'
        });
    }
};

/**
 * @desc    Save/Update document options for a user
 * @route   POST /api/document-options
 * @access  Private
 */
const saveDocumentOptions = async (req, res) => {
    try {
        const userId = req.user._id;
        const updates = req.body;

        // Validate that we have some data to update
        if (!updates || Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No update data provided'
            });
        }

        // Remove userId from updates if present (shouldn't be modified)
        delete updates.userId;

        // For each document type in updates, compute and store resolvedConfig
        const docTypes = [
            'saleInvoice', 'deliveryChallan', 'quotation', 'proforma',
            'purchaseOrder', 'saleOrder', 'jobWork', 'purchaseInvoice',
            'creditNote', 'debitNote', 'multiCurrencyInvoice', 'paymentType',
            'letterOptions', 'inwardPayment', 'outwardPayment'
        ];

        // Reverse map for display names
        const schemaToDocType = {
            'saleInvoice': 'Sale Invoice',
            'deliveryChallan': 'Delivery Challan',
            'quotation': 'Quotation',
            'proforma': 'Proforma Invoice',
            'purchaseOrder': 'Purchase Order',
            'saleOrder': 'Sale Order',
            'jobWork': 'Job Work',
            'purchaseInvoice': 'Purchase Invoice',
            'creditNote': 'Credit Note',
            'debitNote': 'Debit Note',
            'multiCurrencyInvoice': 'Packing List',
            'inwardPayment': 'Inward Payment',
            'outwardPayment': 'Outward Payment'
        };

        docTypes.forEach(schemaKey => {
            if (updates[schemaKey]) {
                // Compute effective config for default series
                const docTypeDisplay = schemaToDocType[schemaKey] || schemaKey;

                const resolvedConfig = computeEffectiveConfig(
                    updates[schemaKey],
                    docTypeDisplay,
                    null // Default series
                );

                // Store it
                updates[schemaKey].resolvedConfig = resolvedConfig;
            }
        });

        // Update or create document options
        const docOptions = await DocumentOption.findOneAndUpdate(
            { userId },
            { $set: updates },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Document options saved successfully',
            data: docOptions
        });

    } catch (error) {
        console.error('[DocumentOptionController] Error saving document options:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to save document options'
        });
    }
};

/**
 * @desc    Get resolved configuration for a specific document type and series
 * @route   GET /api/document-options/resolve
 * @access  Private
 */
const resolveDocumentConfig = async (req, res) => {
    try {
        const userId = req.user._id;
        const { docType, seriesName } = req.query;

        if (!docType) {
            return res.status(400).json({
                success: false,
                message: 'docType is required'
            });
        }

        const resolvedConfig = await fetchAndResolveDocumentOptions(userId, docType, seriesName);

        res.status(200).json({
            success: true,
            data: resolvedConfig
        });

    } catch (error) {
        console.error('[DocumentOptionController] Error resolving document config:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to resolve document configuration'
        });
    }
};

module.exports = {
    getDocumentOptions,
    saveDocumentOptions,
    resolveDocumentConfig
};
