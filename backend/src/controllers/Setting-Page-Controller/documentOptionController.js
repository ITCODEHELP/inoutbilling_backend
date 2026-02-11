const DocumentOption = require('../../models/Setting-Model/DocumentOption');
const { computeEffectiveConfig, mapDocTypeToSchemaKey } = require('../../utils/documentOptionsHelper');

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

        // 3. Save using findOneAndUpdate with upsert
        const options = await DocumentOption.findOneAndUpdate(
            { userId },
            { $set: updates },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        // 4. Return specific section(s) if context provided or inferred, else full object
        const requestedDocType = req.body.documentType || req.body.docType;
        let responseData = {};

        if (requestedDocType) {
            const schemaKey = mapDocTypeToSchemaKey(requestedDocType);
            if (options[schemaKey]) {
                responseData = { [schemaKey]: options[schemaKey] };
            }
        } else {
            // Infer context from body keys if no explicit docType
            const knownSchemaKeys = [
                'saleInvoice', 'deliveryChallan', 'quotation', 'proforma',
                'purchaseOrder', 'saleOrder', 'purchaseInvoice', 'jobWork',
                'creditNote', 'debitNote', 'receipt', 'payment',
                'inwardPayment', 'outwardPayment', 'dailyExpense', 'otherIncome', 'bankLedger',
                'multiCurrencyInvoice'
            ];

            // Check if request body contains any known document keys
            const inferredKeys = Object.keys(req.body).filter(key => knownSchemaKeys.includes(key));

            if (inferredKeys.length > 0) {
                // Return only the update sections
                inferredKeys.forEach(key => {
                    if (options[key]) {
                        responseData[key] = options[key];
                    }
                });
            } else {
                // Fallback to full document if no recognizable keys found
                responseData = options;
            }
        }

        res.status(200).json({
            success: true,
            message: 'Document options saved and resolved successfully',
            data: responseData
        });
    } catch (error) {
        console.error('Error saving document options:', error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};
