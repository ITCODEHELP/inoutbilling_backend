const DocumentOption = require('../models/Setting-Model/DocumentOption');

/**
 * Maps frontend/generic document types to schema keys in DocumentOption model
 */
const mapDocTypeToSchemaKey = (docType) => {
    const map = {
        'Sale Invoice': 'saleInvoice',
        'Delivery Challan': 'deliveryChallan',
        'Quotation': 'quotation',
        'Proforma': 'proforma',
        'Proforma Invoice': 'proforma',
        'Purchase Order': 'purchaseOrder',
        'Sale Order': 'saleOrder',
        'Purchase Invoice': 'purchaseInvoice',
        'Job Work': 'jobWork',
        'Packing List': 'multiCurrencyInvoice',
        'Multi Currency Export Invoice': 'multiCurrencyInvoice',
        'Inward Payment': 'inwardPayment',
        'Outward Payment': 'outwardPayment',
        'Daily Expense': 'dailyExpense',
        'Other Income': 'otherIncome',
        'Bank Ledger': 'bankLedger',
        'Credit Note': 'creditNote',
        'Debit Note': 'debitNote',
        'Receipt': 'inwardPayment',
        'Payment': 'outwardPayment'
    };
    return map[docType] || docType;
};

/**
 * Maps schema keys back to default Display Titles
 */
const mapSchemaKeyToDefaultTitle = (schemaKey) => {
    const map = {
        'saleInvoice': 'SALE INVOICE',
        'deliveryChallan': 'DELIVERY CHALLAN',
        'quotation': 'QUOTATION',
        'proforma': 'PROFORMA INVOICE',
        'purchaseOrder': 'PURCHASE ORDER',
        'saleOrder': 'SALE ORDER',
        'purchaseInvoice': 'PURCHASE INVOICE',
        'jobWork': 'JOB WORK',
        'multiCurrencyInvoice': 'PACKING LIST',
        'inwardPayment': 'RECEIPT VOUCHER',
        'outwardPayment': 'PAYMENT VOUCHER',
        'dailyExpense': 'EXPENSE VOUCHER',
        'otherIncome': 'INCOME VOUCHER',
        'bankLedger': 'BANK LEDGER',
        'creditNote': 'CREDIT NOTE',
        'debitNote': 'DEBIT NOTE'
    };
    return map[schemaKey] || schemaKey.toUpperCase();
};

/**
 * Computes the effective configuration for a document type.
 * logic: Merges user settings > Series Overrides > Defaults.
 * 
 * @param {Object} specificOptions - The raw options object for a specific doc type from DB
 * @param {String} docType - The document type name (e.g. 'Sale Invoice')
 * @param {String} seriesName - Optional specific series to resolve (overrides default/enabled check)
 */
const computeEffectiveConfig = (specificOptions, docType, seriesName = null) => {
    const schemaKey = mapDocTypeToSchemaKey(docType);

    // Default structure
    const result = {
        title: mapSchemaKeyToDefaultTitle(schemaKey),
        resolvedDisplayName: mapSchemaKeyToDefaultTitle(schemaKey),
        headerLabel: '',
        statusLabel: 'Status',
        showStatus: false,
        statusOptions: [],
        otherOptions: {},
        series: { prefix: '', postfix: '', invoiceTitle: '' },
        completionDate: {}
    };

    if (!specificOptions) return result;

    // 1. Resolve Series (Title, etc.)
    let series = null;
    if (specificOptions.invoiceSeries && Array.isArray(specificOptions.invoiceSeries)) {
        if (seriesName) {
            // Check invoiceName (new) or name (legacy/fallback)
            series = specificOptions.invoiceSeries.find(s => (s.invoiceName === seriesName || s.name === seriesName) && s.enabled);
        }
        // Fallback to Default if not found or no seriesName provided
        if (!series) {
            series = specificOptions.invoiceSeries.find(s => s.seriesType === 'Default');
        }
        // Fallback to first enabled if still no series
        if (!series && specificOptions.invoiceSeries.length > 0) {
            series = specificOptions.invoiceSeries.find(s => s.enabled) || specificOptions.invoiceSeries[0];
        }
    }

    if (series) {
        // Priority: invoiceName -> invoiceTitle -> Default System Title
        result.title = series.invoiceName || series.invoiceTitle || result.title;
        result.resolvedDisplayName = result.title; // Explicit field as requested
        result.series = series;
    }

    // 2. Resolve Status Settings
    if (specificOptions.statusSettings) {
        result.showStatus = specificOptions.statusSettings.showStatus;
        result.statusLabel = specificOptions.statusSettings.label || 'Status';
        result.statusOptions = specificOptions.statusSettings.options || [];
    }

    // 3. Resolve Other Options
    if (specificOptions.otherOptions) {
        result.otherOptions = specificOptions.otherOptions;
    }

    // 4. Resolve Completion Date
    if (specificOptions.completionDate) {
        result.completionDate = specificOptions.completionDate;
    }

    return result;
};

/**
 * Centralized Document Options Resolver
 * Fetches and merges user configuration with defaults
 * Fetches and merges user configuration with defaults.
 * Uses stored resolvedConfig if available, otherwise computes it on the fly.
 * 
 * @param {String} userId - The user's ID
 * @param {String} docType - Document type (e.g., 'Sale Invoice')
 * @param {String} seriesName - Optional series name to match
 * @returns {Promise<Object>} Resolved configuration object
 */
const fetchAndResolveDocumentOptions = async (userId, docType, seriesName = null) => {
    try {
        const docOptions = await DocumentOption.findOne({ userId: userId.toString() }).lean();
        const schemaKey = mapDocTypeToSchemaKey(docType);

        if (!docOptions || !docOptions[schemaKey]) {
            return computeEffectiveConfig(null, docType);
        }

        const specificOptions = docOptions[schemaKey];

        // If specific series requested, or no resolvedConfig stored, compute on fly
        if (seriesName || !specificOptions.resolvedConfig || Object.keys(specificOptions.resolvedConfig).length === 0) {
            return computeEffectiveConfig(specificOptions, docType, seriesName);
        }

        // Return stored resolved config
        return specificOptions.resolvedConfig;

    } catch (error) {
        console.error(`[DocumentOptionsHelper] Error resolving options for ${docType}:`, error);
        return {
            title: docType.toUpperCase(),
            error: true
        };
    }
};

module.exports = { fetchAndResolveDocumentOptions, computeEffectiveConfig, mapDocTypeToSchemaKey };
