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
        const userId = req.user.userId || req.user._id;

        // 1. Prepare Update Data
        let updateData = { ...req.body };
        delete updateData.userId; // Secure userId

        // Helper to fix series mapping (name -> invoiceName)
        const fixSeriesMapping = (seriesList) => {
            if (!Array.isArray(seriesList)) return seriesList;
            return seriesList.map(s => {
                const sObj = { ...s };
                // Ensure name is preserved into invoiceName if invoiceName is empty/missing
                if (sObj.name && (!sObj.invoiceName || sObj.invoiceName.trim() === '')) {
                    sObj.invoiceName = sObj.name;
                }
                return sObj;
            });
        };

        // List of document types to check for resolution
        const docTypesToResolve = [
            'Sale Invoice', 'Delivery Challan', 'Quotation', 'Proforma',
            'Purchase Order', 'Sale Order', 'Purchase Invoice', 'Job Work',
            'Credit Note', 'Debit Note', 'Receipt', 'Payment', 'Inward Payment', 'Outward Payment'
        ];

        // 2. Process each key in the update data
        Object.keys(updateData).forEach(key => {
            if (key === 'documentType' || key === 'docType') return;

            // Fix Series Mapping if this section has invoiceSeries
            if (updateData[key] && Array.isArray(updateData[key].invoiceSeries)) {
                updateData[key].invoiceSeries = fixSeriesMapping(updateData[key].invoiceSeries);
            }

            // Compute Resolved Config
            // Find which DocType this key corresponds to
            const matchingDocType = docTypesToResolve.find(dt => mapDocTypeToSchemaKey(dt) === key);

            if (matchingDocType && updateData[key]) {
                const effectiveConfig = computeEffectiveConfig(updateData[key], matchingDocType);
                updateData[key].resolvedConfig = effectiveConfig;
            }
        });

        // 3. Save using findOneAndUpdate with upsert
        const options = await DocumentOption.findOneAndUpdate(
            { userId },
            { $set: updateData },
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
                'inwardPayment', 'outwardPayment', 'dailyExpense', 'otherIncome', 'bankLedger'
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
