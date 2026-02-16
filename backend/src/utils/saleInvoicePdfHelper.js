const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');
const PrintOptions = require('../models/Setting-Model/PrintOptions');
const GeneralSettings = require('../models/Setting-Model/GeneralSetting');
const User = require('../models/User-Model/User');
const BankDetails = require('../models/Other-Document-Model/BankDetail');
const QRCode = require('qrcode');

const TEMPLATE_MAP = {
    'Default': 'Template-Default.html',
    'Designed': 'Template-Default.html',
    'Letterpad': 'Template-Default.html',
    'Template-1': 'Template-1.html',
    'Template-2': 'Template-2.html',
    'Template-3': 'Template-3.html',
    'Template-4': 'Template-4.html',
    'Template-5': 'Template-5.html',
    'Template-6': 'Template-6.html',
    'Template-7': 'Template-7.html',
    'Template-8': 'Template-8.html',
    'Template-9': 'Template-9.html',
    'Template-10': 'Template-10.html',
    'Template-11': 'Template-11.html',
    'Template-12': 'Template-12.html',
    'Template-13': 'Template-13.html',
    'A5-Default': 'Template-A5.html',
    'A5-Designed': 'Template-A5-2.html',
    'A5-Letterpad': 'Template-A5-3.html',
    'Template-A5-4': 'Template-A5-4.html',
    'Template-A5-5': 'Template-A5-5.html',
    'Thermal-2inch': 'Thermal-Template-1.html',
    'Thermal-3inch': 'Thermal-Template-2.html',
    'Thermal-4inch': 'Thermal-Template-3.html',
};

const resolveTemplateFile = (templateName) => {
    const filename = TEMPLATE_MAP[templateName] || 'saleinvoicedefault.html';
    const fullPath = path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', filename);

    if (!fs.existsSync(fullPath)) {
        console.warn(`[PDF Generator] Template file NOT found at: ${fullPath}. Falling back to default.`);
        return path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', 'saleinvoicedefault.html');
    }
    return fullPath;
};

const generateGlobalHeader = (businessData, userData, overrideLogoPath, printSettings = {}) => {
    // Priority: Explicit Override (Passed as Resolved Source)
    let logoSrc = '';
    let rawLogoPath = overrideLogoPath;

    if (rawLogoPath) {
        if (rawLogoPath.startsWith('http')) {
            logoSrc = rawLogoPath;
        } else if (rawLogoPath.startsWith('data:image')) {
            logoSrc = rawLogoPath; // Render Base64 directly
        } else {
            try {
                // Determine absolute path.
                let logoPath = path.resolve(rawLogoPath);

                if (!fs.existsSync(logoPath)) {
                    // Try resolving relative to various possible roots
                    const pathsToTry = [
                        path.join(process.cwd(), 'backend', 'src', 'uploads', 'logo', rawLogoPath),
                        path.join(process.cwd(), 'src', 'uploads', 'logo', rawLogoPath),
                        path.join(process.cwd(), 'uploads', 'business_logos', rawLogoPath),
                        path.join(process.cwd(), 'backend', 'uploads', 'business_logos', rawLogoPath),
                        path.join(__dirname, '..', 'uploads', 'logo', rawLogoPath),
                        path.join(__dirname, '..', rawLogoPath)
                    ];
                    for (const p of pathsToTry) {
                        if (fs.existsSync(p)) {
                            logoPath = p;
                            break;
                        }
                    }
                }

                if (fs.existsSync(logoPath)) {
                    const bitmap = fs.readFileSync(logoPath);
                    const ext = path.extname(logoPath).split('.').pop() || 'png';
                    const base64 = bitmap.toString('base64');
                    logoSrc = `data:image/${ext};base64,${base64}`;
                } else {
                    console.warn(`[PDF Generator] Logo file not found: ${rawLogoPath}`);
                }
            } catch (err) {
                console.error('[PDF Generator] Error loading logo:', err);
            }
        }
    }

    const headerSettings = printSettings.headerPrintSettings || {};
    const hideContact = headerSettings.hideContactDetailInHeader === true;
    const showPan = headerSettings.showPanNumber !== false; // Default true if not set, key is showPanNumber
    const showStaff = headerSettings.showStaffDetailsInHeader === true;

    // Contact Section Logic
    let contactSection = '';
    if (!hideContact) {
        contactSection = `
            <div style="
                text-align: right;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 9px;
                color: #333333;
                line-height: 1.4;
                min-width: 160px;
            ">
                ${showStaff ? `<div><strong>Name:</strong> ${userData.fullName || businessData.fullName || userData.name || ''}</div>` : ''}
                <div><strong>Phone:</strong> ${userData.displayPhone || userData.phone || ''}</div>
                <div><strong>Email:</strong> ${userData.email || businessData.email || ''}</div>
                ${(showPan && (businessData.showPan || userData.showPan) && userData.pan) ? `<div><strong>PAN:</strong> ${userData.pan}</div>` : ''}
            </div>
        `;
    }

    return `
        <div class="global-document-header" style="
            width: 100%;
            padding: 5px 0;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            background: #ffffff;
            page-break-inside: avoid;
            page-break-after: avoid;
        ">
            <!-- Left Section: Logo and Company Details -->
            <div style="display: flex; align-items: flex-start; gap: 10px; flex: 1;">
                ${logoSrc ? `
                    <img src="${logoSrc}" alt="Company Logo" style="
                        max-width: 60px;
                        max-height: 60px;
                        object-fit: contain;
                        display: block;
                    " onerror="this.style.display='none'">
                ` : ''}
                <div style="flex: 1;">
                    <div style="
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 14px;
                        font-weight: bold;
                        color: #000000;
                        margin-bottom: 2px;
                    ">${businessData.companyName || ''}</div>
                    <div style="
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 9px;
                        color: #333333;
                        line-height: 1.2;
                    ">
                        ${businessData.address || ''}<br>
                        ${businessData.city || ''}, ${businessData.state || ''} - ${businessData.pincode || ''}
                    </div>
                </div>
            </div>
 
            <!-- Right Section: Contact Details -->
            ${contactSection}
        </div>
    `;
};

/**
 * Resolves branding images from GeneralSettings
 */
const resolveBrandingImages = async (userId) => {
    const branding = {
        logo: null,
        background: null,
        footer: null,
        signature: null
    };

    if (!userId) return branding;

    try {
        // Ensure we are using the string representation of the ID
        const searchId = userId.toString();
        const settings = await GeneralSettings.findOne({ userId: searchId }).lean();
        if (!settings) return branding;

        const imageFields = [
            { field: 'logoPath', key: 'logo' },
            { field: 'invoiceBackgroundPath', key: 'background' },
            { field: 'invoiceFooterPath', key: 'footer' },
            { field: 'signaturePath', key: 'signature' }
        ];

        for (const { field, key } of imageFields) {
            const rawPath = settings[field];
            if (rawPath) {
                try {
                    let fullPath = path.resolve(rawPath);
                    if (!fs.existsSync(fullPath)) {
                        const pathsToTry = [
                            path.join(process.cwd(), rawPath),
                            path.join(process.cwd(), 'backend', rawPath),
                            path.join(__dirname, '..', '..', rawPath),
                            path.join(__dirname, '..', rawPath)
                        ];
                        for (const p of pathsToTry) {
                            if (fs.existsSync(p)) {
                                fullPath = p;
                                break;
                            }
                        }
                    }

                    if (fs.existsSync(fullPath)) {
                        const bitmap = fs.readFileSync(fullPath);
                        const ext = path.extname(fullPath).split('.').pop() || 'png';
                        branding[key] = `data:image/${ext};base64,${bitmap.toString('base64')}`;
                    }
                } catch (e) {
                    console.error(`[PDF Generator] Error resolving branding ${key}:`, e);
                }
            }
        }
    } catch (e) {
        console.error('[PDF Generator] Error fetching GeneralSettings:', e);
    }

    return branding;
};

/**
 * Generates title section for specific templates (5-11)
 * Displays document type and copy type above the global header
 */
const generateTitleSection = (title, copyLabel) => {
    return `
        <div class="document-title-section" style="
            width: 100%;
            padding: 8px 0;
            margin-bottom: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #ffffff;
            page-break-inside: avoid;
            page-break-after: avoid;
        ">
            <div style="
                font-family: Arial, Helvetica, sans-serif;
                font-size: 16px;
                font-weight: bold;
                color: #0070c0;
            ">${title}</div>
            <div style="
                font-family: Arial, Helvetica, sans-serif;
                font-size: 14px;
                font-weight: bold;
                color: #000000;
            ">${copyLabel}</div>
        </div>
    `;
};

/**
 * Dynamically manages table columns based on data presence.
 * Removes empty columns (Header, Body, Vertical Lines) and adjusts layout.
 */
const manageDynamicColumns = ($, doc, printSettings = {}) => {
    if (!doc.items || !Array.isArray(doc.items) || doc.items.length === 0) return;

    const productSettings = printSettings.productItemSettings || {};

    // 1. Determine Visibility based on Data AND Settings
    // A column is visible if AT LEAST ONE item has a non-empty value for it.
    // Zero (0) is considered a valid value (e.g., Discount = 0).
    const hasValue = (val) => {
        if (val === undefined || val === null) return false;
        const strVal = String(val).trim();
        if (strVal === "") return false;
        // Check if numeric string is effectively > 0 for tax purposes, or handle "0.00"
        return true;
    };

    const parseNum = (val) => {
        if (!val) return 0;
        return parseFloat(String(val).replace(/,/g, '')) || 0;
    };


    // Check for specific fields
    // Logic: Visible if (Data Exists) AND (Not Hidden in Settings)
    const showHsn = !productSettings.hideHsnColumn && doc.items.some(item => hasValue(item.hsnSac));

    // Qty and Rate are usually always shown, but we check to be safe or if user wants to hide them
    const showQty = !productSettings.hideQuantityColumn && doc.items.some(item => hasValue(item.qty));
    const showRate = !productSettings.hideRateColumn && doc.items.some(item => hasValue(item.price) || hasValue(item.rate));

    // Discount: Show if any item has discount OR if explicitly 0 is a valid discount
    const showDiscount = doc.items.some(item => hasValue(item.discount) || hasValue(item.disc));

    // UOM Column (If template supports separate UOM column - usually 'showUomDifferentColumn' implies separating it)
    // Current templates might mix Qty and UOM. If showUomDifferentColumn is true, we might need specific logic (if template supports it).
    // For now, we stick to standard columns.

    // Tax fields (IGST, CGST, SGST)
    const showIgst = doc.items.some(item => Number(item.igst) > 0);
    const showCgst = doc.items.some(item => Number(item.cgst) > 0);
    const showSgst = doc.items.some(item => Number(item.sgst) > 0);

    // 2. Configuration for Selectors (Header, Body, Background Lines, Footer)
    // We target common classes used across templates.
    const colConfig = [
        {
            key: 'hsnSac',
            visible: showHsn,
            selectors: [
                '.hsnsac', '.header-hsn-sac', '.td-body-hsn-sac',
                '[data-column="2"]',
                '.footer-hsnsac', '.footer-hsn-sac'
            ]
        },
        {
            key: 'qty',
            visible: showQty,
            selectors: [
                '.qty', '.header-qty', '.td-body-qty',
                '[data-column="3"]',
                '.footer-total-qty', '.footer-qty'
            ]
        },
        {
            key: 'rate',
            visible: showRate,
            selectors: [
                '.rate', '.header-rate', '.td-body-rate',
                '[data-column="4"]', '.section3_rate',
                '.footer-rate', '._rate_total'
            ]
        },
        {
            key: 'discount',
            visible: showDiscount,
            selectors: [
                '.disc', '.header-disc', '.td-body-disc',
                '[data-column="5"]', '.header-cur-symbol',
                '.footer-total-disc', '.footer-disc'
            ]
        },
        // Tax columns often don't have standard classes in all templates, but adding here for those that do
        {
            key: 'igst',
            visible: showIgst,
            selectors: ['.igst', '.header-igst', '.td-body-igst', '.footer-igst', '.footer-tax']
        },
        {
            key: 'cgst',
            visible: showCgst,
            selectors: ['.cgst', '.header-cgst', '.td-body-cgst', '.footer-cgst']
        },
        {
            key: 'sgst',
            visible: showSgst,
            selectors: ['.sgst', '.header-sgst', '.td-body-sgst', '.footer-sgst']
        }
    ];

    // 3. Remove Hidden Columns
    colConfig.forEach(col => {
        if (!col.visible) {
            col.selectors.forEach(selector => {
                // Remove headers, body cells, and background lines
                $(selector).remove();
            });
        }
    });

    // 4. Adjust Colspan for Footer/Total Rows
    // If columns are removed, the total colspan needs to be reduced.
    // Count visible columns (Assumption: Standard columns are SrNo, Name, HSN, Qty, Rate, Disc, Total)
    // Base columns: SrNo(1), Name(1), Total(1) = 3.
    // Add dynamic columns if visible.
    let visibleColCount = 3; // Sr, Name, Total
    if (showHsn) visibleColCount++;
    if (showQty) visibleColCount++;
    if (showRate) visibleColCount++;
    if (showDiscount) visibleColCount++;
    if (showIgst) visibleColCount++;
    if (showCgst) visibleColCount++;
    if (showSgst) visibleColCount++;

    // Update commonly used colspan cells (e.g., "Total", "Amount in Words" row often spans)
    // We look for cells with high colspan and attempt to adjust them.
    // Strategy: simpler to let the browser handle table layout usually, but for fixed footprint templates, explicit width adjustment is hard via Cheerio calculation.
    // However, we can try to fix the 'footer' row colspan which usually spans (TotalCols - 1) or similar.

    // A simple heuristic: Find cells with colspan > 3 and reduce them? 
    // Or specifically target known footer label cells.
    // Examples: .section4_text_clr (Template 5) spans 1?
    // Template 12: footer table is separate.

    // For now, removing the columns allows the table to auto-layout.
    // To prevent blank gaps, the remaining columns (specifically Description/Name) should expand.
    // We can remove width styles from the 'productname' or 'name' column to let it take remaining space.
    if (!showHsn || !showDiscount || !showQty || !showRate) {
        $('.productname, .header-product-name, .td-body-product-name').css('width', 'auto');
        $('.tableboxLine.productname').css('width', 'auto');
    }
};

/**
 * Main PDF Generation Logic using Puppeteer
 */
const generateSaleInvoicePDF = async (documents, user, options = { original: true }, docType = 'Sale Invoice', printConfig = { selectedTemplate: 'Default', printSize: 'A4', printOrientation: 'Portrait' }) => {
    try {
        const docList = Array.isArray(documents) ? documents : [documents];

        let fullUser = {};
        let businessData = {};
        let printSettings = {};

        // Header Data Objects (Strict Separation)
        let headerLeftData = {};
        let headerRightData = {};
        let brandingAssets = { logo: null, background: null, footer: null, signature: null };

        // --- ROBUST HEADER DATA FETCHING ---
        // Defined outside try-catch to ensure availability in the loop
        let bankDetailsMap = {};


        const rawUserId = user.userId || user._id;

        // 1. Resolve actual user profile
        try {
            fullUser = await User.findOne({
                $or: [
                    { userId: rawUserId },
                    { _id: mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : null }
                ]
            }).lean() || user;
        } catch (e) {
            console.error('[PDF Generator] User fetch failed:', e);
            fullUser = user;
        }

        // Use the definite string userId for all other related queries
        // logic: favor string userId if available (for Business/Settings), but keep implicit _id for refs
        const actualUserIdString = fullUser.userId || (typeof rawUserId === 'string' ? rawUserId : null);
        const actualObjectId = fullUser._id && mongoose.Types.ObjectId.isValid(fullUser._id) ? fullUser._id : null;
        const actualId = (fullUser._id || rawUserId)?.toString();
        const customId = fullUser.userId || rawUserId;

        // 2. Fetch Business Credentials (Try both Custom ID and DB _id for robustness)
        if (customId || actualId) {
            try {
                businessData = await Business.findOne({
                    $or: [
                        { userId: customId },
                        { userId: actualId }
                    ]
                }).lean() || {};
            } catch (e) {
                console.error('[PDF Generator] Business fetch failed:', e);
                businessData = {};
            }
        }

        // 3. Fetch Print Settings (Uses DB _id)
        try {
            const printSearchId = actualObjectId || businessData._id || null;
            if (printSearchId && mongoose.Types.ObjectId.isValid(printSearchId)) {
                printSettings = await PrintOptions.findOne({ userId: printSearchId }).lean() || {};
            }
        } catch (e) {
            console.error('[PDF Generator] PrintOptions fetch failed:', e);
            printSettings = {};
        }

        // 4. Fetch General Settings (Branding)
        // CRITICAL: GeneralSettings are keyed by the MongoDB _id (stringified)
        const brandingSearchId = fullUser._id || rawUserId;
        brandingAssets = await resolveBrandingImages(brandingSearchId);

        // 5. Resolve Document Options (Title Overrides)
        const firstDoc = docList[0] || {};
        const details = firstDoc.invoiceDetails ||
            firstDoc.quotationDetails ||
            firstDoc.deliveryChallanDetails ||
            firstDoc.proformaDetails ||
            firstDoc.creditNoteDetails ||
            firstDoc.debitNoteDetails ||
            firstDoc.saleOrderDetails ||
            firstDoc.purchaseOrderDetails ||
            firstDoc.purchaseInvoiceDetails ||
            firstDoc.jobWorkDetails ||
            firstDoc.multiCurrencyInvoiceDetails ||
            firstDoc.packingListDetails ||
            firstDoc.inwardPaymentDetails ||
            firstDoc.outwardPaymentDetails ||
            {};

        // Extract Series Identifier (Used to find specific title/prefix/postfix overrides in DocumentOptions)
        const seriesName = details.invoiceSeries ||
            details.seriesName ||
            details.invoicePrefix ||
            details.poPrefix ||
            details.soPrefix ||
            details.dnPrefix ||
            details.cnSeries ||
            details.quotationPrefix ||
            details.challanPrefix ||
            null;

        try {
            const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');
            docOptionsData = await fetchAndResolveDocumentOptions(actualUserIdString || rawUserId, docType, seriesName);
        } catch (err) {
            console.error('[PDF Generator] Error resolving document options:', err);
            docOptionsData = {};
        }

        if (!docOptionsData || Object.keys(docOptionsData).length === 0) {
            docOptionsData = { title: docType.toUpperCase() };
        }

        // 5. Fetch All Bank Details for User (Optimization: Fetch once)
        // BankDetails model uses ObjectId ref for userId
        if (actualObjectId) {
            try {
                const banks = await BankDetails.find({ userId: actualObjectId }).lean();
                banks.forEach(b => {
                    bankDetailsMap[b.bankId] = b;
                    // Heuristic for default: first one or explicitly marked (if schema supported it)
                    if (!bankDetailsMap['default']) bankDetailsMap['default'] = b;
                });
            } catch (e) {
                console.error('[PDF Generator] BankDetails fetch failed:', e);
            }
        }

        // --- SHARED HEADER DATA BUILDER ---
        headerLeftData = {
            companyName: businessData.companyName || fullUser.companyName || '',
            address: businessData.address || fullUser.address || '',
            city: businessData.city || fullUser.city || '',
            state: businessData.state || fullUser.state || '',
            pincode: businessData.pincode || fullUser.pincode || '',
            gstin: businessData.gstin || fullUser.gstin || fullUser.gstNumber || '',
            businessLogo: brandingAssets.logo || ''
        };

        headerRightData = {
            fullName: fullUser.fullName || businessData.fullName || fullUser.name || '',
            email: fullUser.email || businessData.email || '',
            phone: fullUser.displayPhone || fullUser.phone || businessData.phone || '',
            pan: null
        };

        if (printSettings?.headerPrintSettings?.showPan && (fullUser.pan || businessData.pan)) {
            headerRightData.pan = fullUser.pan || businessData.pan;
        }

        // --- TEMPLATE RESOLUTION ---
        const config = typeof printConfig === 'string' ?
            { selectedTemplate: printConfig, printSize: 'A4', printOrientation: 'Portrait' } :
            (printConfig || { selectedTemplate: 'Default', printSize: 'A4', printOrientation: 'Portrait' });

        const templateName = config.selectedTemplate || 'Default';
        const printSize = config.printSize || 'A4';
        const orientation = (config.printOrientation || 'Portrait').toLowerCase();

        const templatePath = resolveTemplateFile(templateName);
        let baseHtml = fs.readFileSync(templatePath, 'utf8');

        const copies = [];
        if (options.original) copies.push('original');
        if (options.duplicate) copies.push('duplicate');
        if (options.transport) copies.push('transport');
        if (options.office) copies.push('office');
        if (copies.length === 0) copies.push('original');

        let fullPageHtml = "";

        // --- BATCH DOCUMENT LOOP (PER-DOCUMENT RESOLUTION) ---
        for (const [docIdx, doc] of docList.entries()) {
            const details = doc.invoiceDetails || doc.quotationDetails || doc.deliveryChallanDetails || doc.proformaDetails || doc.creditNoteDetails || doc.debitNoteDetails || doc.saleOrderDetails || doc.purchaseOrderDetails || doc.purchaseInvoiceDetails || doc.jobWorkDetails || doc.multiCurrencyInvoiceDetails || doc.packingListDetails || doc.inwardPaymentDetails || doc.outwardPaymentDetails || {};

            const seriesName = details.invoiceSeries || details.seriesName || details.invoicePrefix || details.poPrefix || details.soPrefix || details.dnPrefix || details.cnSeries || details.quotationPrefix || details.challanPrefix || details.docPrefix || null;

            let currentDocOptions = {};
            try {
                const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');
                currentDocOptions = await fetchAndResolveDocumentOptions(actualId, docType, seriesName);
            } catch (err) {
                console.error('[PDF Generator] Series resolution failed:', err);
                currentDocOptions = { title: docType.toUpperCase() };
            }

            for (const copyType of copies) {
                const $ = cheerio.load(baseHtml);


                // Inject Print Styles
                $('head').append(`
                <style>
                    @media print {
                        /* Strip most backgrounds but preserve branding and table styles */
                        *:not(.page-wrapper):not(.page-content):not(.branding-footer-image):not(.branding-signature-image):not(table):not(thead):not(tbody):not(tr):not(th):not(td):not(.page-header) {
                            background-color: transparent !important;
                            box-shadow: none !important;
                        }
                        body, .page-copy-container-wrapper, .page-wrapper-table {
                            background-color: transparent !important;
                        }
                        body { width: 210mm !important; margin: 0 auto !important; padding: 0 !important; }
                        .page-wrapper-table, .page-copy-container-wrapper { margin: 0 auto !important; }
                        .page-wrapper, .page-content, .page-wrapper-tr, .page-wrapper-letter, .page-copy-container-wrapper, .invoice, table, tbody, .branding-footer-image, .branding-signature-image, .branding-footer-container, .branding-signature-container, .invoiceTotal, .footer_seal_title, .footer_seal_name, .footer_seal_signature, .foot_table_signature {
                            page-break-inside: avoid !important;
                            page-break-before: avoid !important;
                            page-break-after: avoid !important;
                        }
                        html, body { height: auto !important; overflow: visible !important; }
                        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            `);

                // Resolved Logo logic
                let logoSrc = brandingAssets.logo;
                if (!logoSrc && options.overrideLogoPath) {
                    // (Omitted for brevity, assuming global assets are sufficient as per user request)
                }

                const copyLabels = { 'original': 'ORIGINAL FOR RECIPIENT', 'duplicate': 'DUPLICATE COPY', 'transport': 'DUPLICATE FOR TRANSPORTER', 'office': 'TRIPLICATE FOR SUPPLIER' };
                const copyLabel = copyLabels[copyType] || `${copyType.toUpperCase()} COPY`;

                // Use the resolved title from DocumentOptions (Priority: Name > Title > Default)
                const titleToUse = currentDocOptions.title || options.titleLabel || (docType === 'Sale Invoice' ? 'SALE INVOICE' : docType.toUpperCase());

                const templatesWithTitle = ['Template-5', 'Template-6', 'Template-7', 'Template-8', 'Template-9', 'Template-10', 'Template-11'];
                const shouldShowTitle = templatesWithTitle.includes(templateName);

                // Broaden injection to multiple common title selectors
                const titleSelectors = ['.invoice-title', '.document-title', '[data-editor=".main-border .invoice-title"]', '#headersec h3', '.page-header h3'];
                let titleInjected = false;

                for (const selector of titleSelectors) {
                    if ($(selector).length > 0) {
                        if (shouldShowTitle) {
                            // If we are generating a separate title section, hide/clear existing ones to prevent duplicates
                            $(selector).text('');
                        } else {
                            // Otherwise, update them in place
                            $(selector).text(titleToUse);
                            titleInjected = true;
                        }
                    }
                }

                if (shouldShowTitle) {
                    $('.copyname').text('');
                    // Clean templates that have hardcoded default titles
                    $('#headersec h3, .page-header h3').each(function () {
                        const txt = $(this).text().trim().toUpperCase();
                        const defaults = ['TAX INVOICE', 'DEBIT NOTE', 'CREDIT NOTE', 'QUOTATION', 'SALE INVOICE', 'PROFORMA INVOICE', 'DELIVERY CHALLAN', 'PURCHASE ORDER', 'SALE ORDER', 'PURCHASE INVOICE', 'JOB WORK', 'PACKING LIST', 'MULTI CURRENCY EXPORT INVOICE', 'EXPORT INVOICE'];
                        if (defaults.includes(txt)) {
                            $(this).text('');
                        }
                    });
                } else {
                    $('.copyname').text(copyLabel);
                }

                // Populate Business Info
                $('.org_orgname, .company_name_org').text(headerLeftData.companyName || "").css('text-align', 'left');
                let addressHtml = headerLeftData.address || "";
                if (headerLeftData.city || headerLeftData.state || headerLeftData.pincode) {
                    addressHtml += `<br>${headerLeftData.city || ""}, ${headerLeftData.state || ""} - ${headerLeftData.pincode || ""}`;
                }
                if (headerLeftData.gstin) { addressHtml += `<br><strong>GSTIN:</strong> ${headerLeftData.gstin}`; }
                $('.org_address, .company_address_org').html(addressHtml).css('text-align', 'left');

                // Populate Contact Info
                $('.org_contact_name, .company_contact_name').html(headerRightData.fullName ? `<b>Name</b> : ${headerRightData.fullName}` : "").css('text-align', 'right');
                $('.org_phone').html(headerRightData.phone ? `<b>Phone</b> : ${headerRightData.phone}` : "").css('text-align', 'right');
                if (headerRightData.email) {
                    if ($('.org_email').length > 0) { $('.org_email').html(`<b>Email</b> : ${headerRightData.email}`).css('text-align', 'right'); }
                    else { $('.org_phone').closest('tr').parent().append(`<tr><td class="contact_details org_email" style="text-align: right;"><b>Email</b> : ${headerRightData.email}</td></tr>`); }
                }
                if (headerRightData.pan) {
                    if ($('.org_pan_row').length > 0) { $('.org_pan_row').html(`<b>PAN</b> : ${headerRightData.pan}`).css('text-align', 'right'); }
                    else { $('.org_phone').closest('tr').parent().append(`<tr><td class="contact_details org_pan_row" style="text-align: right;"><b>PAN</b> : ${headerRightData.pan}</td></tr>`); }
                }

                $('.company_contact_no, .company_email').css('display', 'none');

                // Logo Placement
                if (logoSrc) {
                    const logoSelectors = ['.company-logo', '.business-logo', '.org_logo', '#logo', '.logo img', 'img[alt*="logo" i]', 'img[src*="logo" i]'];
                    let logoReplaced = false;
                    for (const s of logoSelectors) { if ($(s).length > 0) { $(s).attr('src', logoSrc); logoReplaced = true; } }
                    if (!logoReplaced && $('.org_orgname').length > 0) {
                        $('.org_orgname').closest('table').wrap('<div style="display: flex; align-items: flex-start; gap: 15px;"></div>').before(`<img src="${logoSrc}" style="max-height: 70px; max-width: 200px; object-fit: contain;">`);
                    }
                }

                // Branding Assets
                if (brandingAssets.background) {
                    const bgSelector = $('.page-content').length > 0 ? '.page-content' : ($('.page-wrapper').length > 0 ? '.page-wrapper' : 'body');
                    const bgPositioning = bgSelector === 'body' ? 'fixed' : 'absolute';
                    $('head').append(`<style>${bgSelector}::before { content: ""; position: ${bgPositioning}; top: 0; left: 0; width: 100%; height: 100%; background-image: url("${brandingAssets.background}") !important; background-size: contain !important; background-repeat: no-repeat !important; background-position: center !important; z-index: -1; pointer-events: none; }</style>`);
                }
                if (brandingAssets.footer) { $('head').append(`<style>body::after { content: ""; position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background-image: url("${brandingAssets.footer}") !important; background-size: contain !important; background-position: center bottom !important; z-index: -1; pointer-events: none; }</style>`); }
                if (brandingAssets.signature) {
                    const sigHtml = `<img src="${brandingAssets.signature}" style="max-height: 40px; max-width: 150px; display: block; margin: 0 auto; object-fit: contain;">`;
                    if ($('.foot_table_signature td').length > 0) { $('.foot_table_signature td').html(sigHtml); }
                    else if ($('.no_sign').length > 0) { $('.no_sign').html(sigHtml); }
                    else if ($('.footer_seal_signature').length > 0) { $('.footer_seal_signature').html(sigHtml); }
                    else if ($('.page-footer').length > 0) { $('.page-footer').prepend(`<div style="text-align: right;">${sigHtml}</div>`); }
                }

                // Global Header Fallback
                if ($('.org_orgname').length === 0 && $('.branding').length === 0) {
                    const brandingHtml = generateGlobalHeader(headerLeftData, headerRightData, logoSrc, printSettings);
                    const wrapper = $('.page-wrapper').length > 0 ? $('.page-wrapper') : $('body');
                    if (shouldShowTitle) { wrapper.prepend(generateTitleSection(titleToUse, copyLabel)); }
                    wrapper.prepend(brandingHtml);
                } else if (shouldShowTitle) {
                    const wrapper = $('.page-wrapper').length > 0 ? $('.page-wrapper') : $('body');
                    wrapper.prepend(generateTitleSection(titleToUse, copyLabel));
                }

                // --- DYNAMIC PRINT SETTINGS LOGIC ---
                const pHeader = printSettings.headerPrintSettings || {};
                const pCust = printSettings.customerDocumentPrintSettings || {};
                const pProduct = printSettings.productItemSettings || {};
                const pFooter = printSettings.footerPrintSettings || {};
                const pStyle = printSettings.documentPrintSettings || {};

                // 1. Header Rules
                if (pHeader.hideDispatchFrom) {
                    $('.dispatch_detail, .dispatch-section').remove();
                }
                if (pHeader.showExporterDetails === false) {
                    $('.exporter_details').remove();
                }
                if (pHeader.showBlankCustomFields === false) {
                    $('.custom_field_row:empty, .custom_field_row:contains("-")').remove();
                }

                // 2. Customer & Document Rules
                if (pCust.hideDueDate) {
                    $('.extra_field:contains("Due Date")').remove();
                }
                if (pCust.hideTransport) {
                    $('.transport_documents').remove();
                }
                if (pCust.hideCurrencyRate) {
                    $('.currency_rate_row').remove();
                }
                if (pCust.showPaymentReceived === false) {
                    $('.payment_received_row').remove();
                }
                if (pCust.showTotalOutstanding === false) {
                    $('.total_outstanding_row').remove();
                }
                if (pCust.showReverseCharge === false) {
                    $('.reverse_charge_row').remove();
                }

                // Hide specific customer fields
                if (pCust.showContactPerson === false) {
                    $('.company_contact_name').remove();
                }
                if (pCust.showStateInCustomerDetail === false) {
                    $('.cmp_state').remove();
                }
                // (Add more specific removals as needed based on template classes)


                // 3. Product Rules
                if (pProduct.hideSrNoAdditionalCharges) {
                    $('.additional_charge_srno').html('&nbsp;');
                }
                if (pProduct.hideTotalQuantity) {
                    $('.footer-total-qty').html('&nbsp;');
                }

                // 4. Footer Rules
                if (pFooter.showRoundOff === false) {
                    $('.round_off_row').remove();
                }
                if (pFooter.showPageNumber === false) {
                    $('.page-number').remove();
                }
                if (pFooter.printSignatureImage === false) {
                    $('.foot_table_signature img, .branding-signature-image').remove();
                }
                if (pFooter.showHsnSummary === false) {
                    $('.hsn-summary-table, .hsn_summary_section').remove();
                }
                if (pFooter.showSubtotalDiscount === false) {
                    $('.discount_row_footer').remove();
                }
                if (pFooter.showPaymentReceivedBalance === false) {
                    $('.payment_balance_row').remove();
                }
                if (pFooter.showCustomerSignatureBox === false) {
                    $('.customer_signature_box').remove();
                }
                if (pFooter.showFooterImage === false) {
                    $('.branding-footer-image').remove();
                }

                // 4. Styling Logic (Fonts & Colors)
                const fontFamily = pStyle.fontFamily || 'Roboto';

                // Robust Color Fallback Logic
                // Global Border Color (Default: #0070C0)
                const borderColor = pStyle.printBlackWhite ? '#000000' :
                    (pStyle.invoiceBorderColor && pStyle.invoiceBorderColor !== 'null' && pStyle.invoiceBorderColor !== 'undefined' ? pStyle.invoiceBorderColor : '#0070C0');

                // Specific Light Blue Replacement Color (Default: #E8F3FD)
                const lightBlueReplacementColor = pStyle.printBlackWhite ? '#f0f0f0' :
                    (pStyle.invoiceBackgroundColor && pStyle.invoiceBackgroundColor !== 'null' && pStyle.invoiceBackgroundColor !== 'undefined' ? pStyle.invoiceBackgroundColor : '#E8F3FD');

                // Inject Dynamic CSS
                $('head').append(`
                <style>
                    :root {
                        --invoice-border-color: ${borderColor};
                        --invoice-border-dynamic: ${borderColor};
                        --invoice-light-blue-color: ${lightBlueReplacementColor};
                    }

                    body, .page-wrapper, table, td, th, div, span, p {
                        font-family: '${fontFamily}', 'Arial', sans-serif !important;
                    }

                    /* 🎯 Global Border Replacement */
                    .main-border, .invoiceTotal td, .invoiceInfo td, .billdetailsthead td, .invoicedataFooter td, 
                    .customerdata td.customerdata_label, .header-row, .tableboxLine, .tableboxLinetable td, 
                    .invoice .main-border, hr, .sectionDivider, .divider-line,
                    .section3_thead, .section3_tbl_border, .totalamountinword,
                    .border-theme, .stroke-theme {
                        border-color: var(--invoice-border-color) !important;
                    }

                    /* 🎯 Specific Light Blue Background Replacement */
                    /* Targeted ONLY at areas that are typically light blue in templates */
                    .billdetailsthead td, .invoicedataFooter td, .invoiceTotal td.special, 
                    .info-highlight, .summary-highlight, .tax-summary-row-highlight,
                    .section-header-highlight, .tableboxLine.total, .bg-light-theme {
                         background-color: var(--invoice-light-blue-color) !important;
                    }

                    /* 🎯 Elements that use Border Color as Background (Full Accent) */
                    .section3_thead, .bg-theme, .header-accent {
                        background-color: var(--invoice-border-color) !important;
                        color: #ffffff !important;
                    }
                    
                    /* 🎯 Text Colors tied to theme */
                    .invoice-title, .invoice_no b, .invoice_date b, .org_orgname, .total-heading,
                    #headersec h3, .page-header h3, .text-theme, strong.invoice-title, 
                    .section2_title, .customerdata_item_label.special {
                        color: ${pStyle.printBlackWhite ? '#000000' : 'var(--invoice-border-color)'} !important;
                    }

                    /* Ensure hr tags use theme color */
                    hr {
                        border-top-color: var(--invoice-border-color) !important;
                        background-color: var(--invoice-border-color) !important;
                    }
                </style>
                `);

                // 🎯 Dynamic Inline Style Replacement (Safety Net)
                // This ensures that even inline styles like style="border: 1px solid #0070c0" are replaced
                $('*[style]').each(function () {
                    let style = $(this).attr('style');
                    if (!style) return;

                    let originalStyle = style;

                    // Replace Hardcoded Blue Borders/Lines
                    style = style.replace(/#0070c0/gi, borderColor);
                    style = style.replace(/rgb\(\s*0\s*,\s*112\s*,\s*192\s*\)/gi, borderColor);

                    // Replace Hardcoded Light Blue Backgrounds
                    style = style.replace(/#e8f3fd/gi, lightBlueReplacementColor);
                    style = style.replace(/rgb\(\s*232\s*,\s*243\s*,\s*253\s*\)/gi, lightBlueReplacementColor);
                    style = style.replace(/rgba\(\s*232\s*,\s*243\s*,\s*253\s*,\s*1\s*\)/gi, lightBlueReplacementColor);

                    if (style !== originalStyle) {
                        $(this).attr('style', style);
                    }
                });


                // Customer Info
                if (doc.customerInformation) {
                    $('.company_name .special').text(doc.customerInformation.ms || "");
                    $('.company_address td:last-child div').text(doc.customerInformation.address || "");
                    $('.cmp_gstno').text(doc.customerInformation.gstinPan || "");
                }

                // Invoice Details
                const docNum = options.numValue || details.invoiceNumber || details.quotationNumber || details.challanNumber || details.proformaNumber || details.cnNumber || details.dnNumber || details.soNumber || details.poNumber || details.jobWorkNumber || "";
                const docDate = options.dateValue || (details.date || details.cnDate || details.dnDate || details.quotationDate || details.challanDate || details.proformaDate || details.soDate || details.poDate || details.jobWorkDate ? new Date(details.date || details.cnDate || details.dnDate || details.quotationDate || details.challanDate || details.proformaDate || details.soDate || details.poDate || details.jobWorkDate).toLocaleDateString() : "");
                $('.invoice_no .special').text(docNum);
                $('.invoice_date td:last-child').text(docDate);

                // Dynamic Labels for Number and Date
                if (docType === 'Credit Note') {
                    $('.invoice_no b').text(options.numLabel || 'C.N. No.');
                    $('.invoice_date b').text(options.dateLabel || 'C.N. Date');
                } else if (docType === 'Debit Note') {
                    $('.invoice_no b').text(options.numLabel || 'D.N. No.');
                    $('.invoice_date b').text(options.dateLabel || 'D.N. Date');
                } else if (options.numLabel || options.dateLabel) {
                    if (options.numLabel) $('.invoice_no b').text(options.numLabel);
                    if (options.dateLabel) $('.invoice_date b').text(options.dateLabel);
                }

                // --- DYNAMIC COLUMNS MANAGEMENT ---
                // Remove empty columns and adjust layout BEFORE generating rows
                manageDynamicColumns($, doc);

                // --- DYNAMIC DISCOUNT SYMBOL ---
                // Updates the column header symbol (e.g., (%) or (₹)) based on item discount types
                let hasPercentage = false;
                let hasFlat = false;
                if (doc.items && Array.isArray(doc.items)) {
                    // Re-use robust parsing logic if possible, or define locally
                    const parseVal = (v) => {
                        if (!v) return 0;
                        return parseFloat(String(v).replace(/,/g, '')) || 0;
                    };

                    doc.items.forEach(item => {
                        const val = parseVal(item.discount) || parseVal(item.disc) || 0;
                        // Check type if val > 0
                        if (val > 0) {
                            const discType = (item.discountType || "").trim().toLowerCase();
                            if (discType === 'percentage') hasPercentage = true;
                            else hasFlat = true; // Assume flat for any other non-empty value
                        }
                    });
                }

                const $headerSymbol = $('.header-cur-symbol');
                if ($headerSymbol.length > 0) {
                    if (hasPercentage && !hasFlat) {
                        $headerSymbol.text('(%)');
                    } else if (hasFlat && !hasPercentage) {
                        $headerSymbol.text('(₹)');
                    } else {
                        $headerSymbol.text(''); // Mixed (symbol shown in rows) or None
                    }
                }

                // Items Table
                // Handling for different template structures (Template 1-4 vs 5-13 vs Thermal)
                // Common strategy: Find the tbody, extract the first row as template, clear, and append.

                // Try standard selector (Template 1-4, 12, 13)
                let $tbody = $('#billdetailstbody tbody');

                // Fallback for Template 5-11 (often use .billdetailstbody class on table directly or #section3)
                if ($tbody.length === 0) {
                    $tbody = $('.billdetailstbody tbody');
                }
                if ($tbody.length === 0) {
                    $tbody = $('.section3_table tbody');
                }

                if ($tbody.length > 0) {
                    const $rowTemplate = $tbody.find('tr').first().clone();
                    $tbody.empty();

                    if (doc.items && Array.isArray(doc.items)) {
                        doc.items.forEach((item, index) => {
                            const $row = $rowTemplate.clone();
                            // Populate standard fields
                            $row.find('.td-body-sr-no').text(index + 1);

                            // Product Name (Handle various field names)
                            const pName = item.productName || item.name || item.productDescription || "N/A";
                            // Check if we need to append description? User didn't ask, but good practice.
                            $row.find('.td-body-product-name, .productname h4').html(`<h4>${pName}</h4>${item.description ? `<p>${item.description}</p>` : ''}`);

                            // Helper to safely set text if element exists (it might have been removed by dynamic logic)
                            const setText = (selector, val) => {
                                if ($row.find(selector).length) {
                                    $row.find(selector).text(val);
                                }
                            };

                            setText('.td-body-hsn-sac', item.hsnSac || "");
                            setText('.td-body-qty', item.qty || 0);
                            setText('.td-body-rate', (Number(item.price) || Number(item.rate) || 0).toFixed(2));

                            // Discount: Ultra-Robust Parsing and Handling
                            // Discount: Display based on discountType and discountValue
                            const parseVal = (v) => {
                                if (v === undefined || v === null) return 0;
                                const cleaned = String(v).replace(/[^0-9.-]/g, ''); // Keep only numbers, dot, minus
                                return parseFloat(cleaned) || 0;
                            };

                            // Use discountValue for display logic as requested
                            let discVal = parseVal(item.discountValue);
                            let discText = "";
                            const discType = (item.discountType || "").trim().toLowerCase();

                            // Logic: Format based on Type
                            if (discVal > 0 || (discVal === 0 && discType)) {
                                if (discType.includes('percent') || discType === 'percentage') {
                                    discText = `${discVal}%`; // Expected output: "12%" (user didn't ask for .00)
                                } else {
                                    // Flat or default
                                    discText = `₹${discVal}`;
                                }
                            } else {
                                // Fallback: try raw discountValue if exists
                                discText = (item.discountValue !== undefined && item.discountValue !== null && item.discountValue !== "" ? item.discountValue : "");
                            }

                            // 3. Set Text with extended selectors for Template 5 and others
                            setText('.td-body-disc, [data-column="5"], .disc', discText);

                            // Taxes (if columns exist)
                            setText('.td-body-igst', (Number(item.igst) || 0).toFixed(2));
                            setText('.td-body-cgst', (Number(item.cgst) || 0).toFixed(2));
                            setText('.td-body-sgst', (Number(item.sgst) || 0).toFixed(2));

                            // Total
                            setText('.td-body-item-total', (Number(item.total) || 0).toFixed(2));

                            $tbody.append($row);
                        });
                    }
                } else {
                    // Thermal Template or other structure handling? (Leaving existing logic if it differs, but snippet suggests this covers most)
                }

                // Totals
                if (doc.totals) {
                    const totalQty = (doc.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                    const totalItems = (doc.items || []).length;

                    $('.footer-total-qty').text(totalQty.toFixed(2));
                    $('._footer_total').text((doc.totals.grandTotal || 0).toFixed(2));
                    $('.amount_in_words').text(doc.totals.totalInWords || "");

                    // User Request: Ensure ._total_amount_after_tax_filed .special is populated
                    $('._total_amount_after_tax_filed .special').text(`₹  ${(doc.totals.grandTotal || 0).toFixed(2)}`);

                    // User Request: Total Items / Qty string
                    // Selector: .section4_text_clr
                    // We check if the element exists and update it
                    if ($('.section4_text_clr').length > 0) {
                        // Preserve the label if possible or just overwrite
                        // Template 7 format: "Total Items / Qty : <b...>...</b>"
                        $('.section4_text_clr').html(`Total Items / Qty : <b class="hideonlyformat">${totalItems} / ${totalQty.toFixed(2)}</b>`);
                    }

                    // Fix: Update Grand Total in Summary Section (Standard & Thermal Templates)
                    const grandFinal = (doc.totals.grandTotal || 0).toFixed(2);

                    // 1. Standard Template Summary Row
                    const summaryTotalRow = $('._total_amount_after_tax_filed');
                    if (summaryTotalRow.length > 0) {
                        // Target the specific amount cell (usually with .special or the last cell)
                        const amountCell = summaryTotalRow.find('.special').last();
                        // Fallback to last-child if .special not found
                        const targetCell = amountCell.length > 0 ? amountCell : summaryTotalRow.find('td').last();

                        if (targetCell.length > 0) {
                            const currentText = targetCell.text();
                            // Preserve currency symbol if it existed in the template placeholder
                            if (currentText.includes('₹')) {
                                targetCell.text(`₹ ${grandFinal}`);
                            } else {
                                targetCell.text(grandFinal);
                            }
                        }
                    }

                    // 2. Thermal Template Grand Total Row
                    const thermalTotalRow = $('._grand_total');
                    if (thermalTotalRow.length > 0) {
                        const amountCell = thermalTotalRow.find('td').last();
                        if (amountCell.length > 0) {
                            const currentText = amountCell.text();
                            if (currentText.includes('₹')) {
                                amountCell.text(`₹${grandFinal}`);
                            } else {
                                amountCell.text(grandFinal);
                            }
                        }
                    }
                }
                $('.footer_seal_name').text(`For ${user.companyName || "Company"}`);

                // --- DYNAMIC CUSTOMER & SHIPPING DETAILS ---
                if (doc.customerInformation) {
                    const cust = doc.customerInformation;

                    // Buyer Details Population - Robust Fallback
                    // Ensure we capture Name from any likely property
                    // User confirmed data has 'ms' field for Buyer Name
                    const buyerNameVal = cust.ms || cust.name || cust.companyName || cust.billingName || (doc.billingDetails && doc.billingDetails.name) || "";

                    if (buyerNameVal) {
                        $('.buyer_name_text').text(buyerNameVal);
                    } else {
                        // If no name found, at least try to keep the Handlebars placeholder or show empty?
                        // If it enters here, it means text() wasn't called, so Handlebars {{buyerName}} remains in HTML
                        // But if Handlebars failed, it's empty.
                        // Let's force a check on the data-editor attribute just in case
                        if ($('.buyer_name_text').text().trim() === "") {
                            $('.buyer_name_text').text("Buyer Name Not Found"); // Temporary debug or fallback? 
                            // Better: leave it alone if empty, maybe Handlebars worked?
                            // But user says "not visible". So let's trust the variable.
                        }
                    }

                    if (cust.phone) {
                        $('.company_contact_no').css('display', 'table-row');
                        $('.company_contact_no td:last-child').text(`${cust.phone}`);
                    } else {
                        $('.company_contact_no').css('display', 'none');
                    }

                    if (cust.email) {
                        $('.company_email').css('display', 'table-row');
                        $('.company_email td:last-child').text(`${cust.email}`);
                    } else {
                        $('.company_email').css('display', 'none');
                    }

                    if (cust.pan) {
                        $('.company_pan_no').css('display', 'table-row');
                        $('.company_pan_no .cmp_gstno').text(cust.pan);
                    } else {
                        $('.company_pan_no').css('display', 'none');
                    }

                    if (cust.placeOfSupply) {
                        $('.company_place_of_supply').css('display', 'table-row');

                        let posText = cust.placeOfSupply;
                        // Append state code if available (avoiding empty brackets)
                        const sCode = cust.stateCode || cust.billingStateCode || doc.stateCode || "";
                        if (sCode && !posText.includes(sCode)) {
                            posText += ` (${sCode})`;
                        }

                        // Target the value cell: usually the last TD in the row (skipping label)
                        // This overwrites any {{handlebars}} placeholders cleanly
                        const $posCell = $('.company_place_of_supply td:not(.customerdata_item_label):last-child');
                        if ($posCell.length > 0) {
                            $posCell.text(posText);
                        } else if ($('.company_place_of_supply .section2_invo2').length > 0) {
                            $('.company_place_of_supply .section2_invo2').text(posText);
                        }
                    } else {
                        $('.company_place_of_supply').css('display', 'none');
                    }

                    // SHIPPING DETAILS LOGIC
                    // Check for shippingDetails object OR legacy fields
                    const shipName = doc.shippingDetails?.name || cust.shipTo || "";
                    const shipAddress = doc.shippingDetails?.address || cust.shippingAddress || "";
                    const shipGstin = doc.shippingDetails?.gstin || "";
                    const shipState = doc.shippingDetails?.state || "";
                    const shipPhone = doc.shippingDetails?.phone || "";

                    // Visibility Check: Hide if no meaningful shipping info OR if same as billing
                    const isSameAsBilling = (shipName === cust.ms) && (!shipAddress || shipAddress === cust.address);
                    // Minimal requirement: Name must exist and be different, OR Address must exist.
                    const hasShippingData = (shipName || shipAddress) && !isSameAsBilling;

                    if (hasShippingData) {
                        // Populate Shipping
                        $('.shipping_name_text').text(shipName);

                        let fullShipAddrHtml = shipAddress;
                        // Reconstruction of Address + State + Pincode to match Template logic
                        // Since we overwrite the inner DIV, we must include State/Pin if they exist.
                        // We use the same classes as Template for consistency.

                        // Add City if available (doc.shippingDetails.city) - often in address, but let's check
                        const shipCity = doc.shippingDetails?.city || "";
                        if (shipCity && !fullShipAddrHtml.includes(shipCity)) {
                            fullShipAddrHtml += `<span class="cmp_city">, ${shipCity}</span>`;
                        }

                        if (shipState) {
                            fullShipAddrHtml += `<span class="shippingState">, ${shipState}</span>`;
                        }

                        // Country hardcoded to India in template, we can append it or leave it
                        fullShipAddrHtml += `, India`;

                        const shipPin = doc.shippingDetails?.pincode || doc.shippingDetails?.zipcode || "";
                        if (shipPin) {
                            fullShipAddrHtml += `<span class="shippingPincode"> - ${shipPin}</span>`;
                        }

                        $('.shipping_address td:last-child div').html(fullShipAddrHtml);
                        $('.shipping_address').css('display', 'table-row');

                        if (shipPhone) {
                            $('.shipping_phone').css('display', 'table-row');
                            $('.shipping_phone td:last-child').text(`${shipPhone}`);
                        } else {
                            $('.shipping_phone').css('display', 'none');
                        }

                        if (shipGstin) {
                            $('.shipping_gstin').css('display', 'table-row').find('.cmp_gstno').text(shipGstin);
                        } else {
                            $('.shipping_gstin').css('display', 'none');
                        }

                        if (shipState) {
                            $('.shipping_state').css('display', 'table-row');
                            $('.shipping_state td:last-child').text(`${shipState}`);
                        } else {
                            $('.shipping_state').css('display', 'none');
                        }

                    } else {
                        // HIDE THE SHIPPING COLUMN
                        // Find the TD containing .shipping_label
                        const $shippingLabel = $('.shipping_label');
                        if ($shippingLabel.length > 0) {
                            const $shippingTd = $shippingLabel.closest('td');
                            $shippingTd.remove();

                            // Adjust Layout: Change 3 columns to 2 columns (50% each)
                            const $customerTable = $('.customerdata');
                            const $colgroup = $customerTable.find('colgroup');
                            if ($colgroup.length > 0) {
                                $colgroup.empty();
                                $colgroup.append('<col style="width: 50%" />');
                                $colgroup.append('<col style="width: 50%" />');
                            }
                        }
                    }
                }

                // Terms & Conditions - Hide if empty
                // Check if text exists
                const termsText = doc.termsDetails || (doc.termsAndConditions ? doc.termsAndConditions.text : "");
                if (!termsText || termsText.trim() === "") {
                    $('.termCondition').css('display', 'none');
                } else {
                    $('.termCondition').css('display', 'block');
                    if ($('.terms_condition_box').length > 0) {
                        $('.terms_condition_box').html(termsText.replace(/\n/g, '<br>'));
                    }
                }

                // --- TRANSPORT DETAILS LOGIC ---
                // User Request: "do same for transport field" (Conditional Render)
                // Field variants: transportMode, transportName, or just transport
                // We check details object mainly
                const transportVal = details.transportMode || details.transportName || details.transport || "";

                if (transportVal) {
                    $('.transport_name').css('display', 'table-row');
                    // Target the value cell (last one)
                    const $transportCell = $('.transport_name td:not(.invoicedata_item_label):last-child');
                    if ($transportCell.length > 0) {
                        $transportCell.text(transportVal);
                    }
                } else {
                    $('.transport_name').css('display', 'none');
                }

                // --- BANK DETAILS & QR CODE INJECTION ---
                if (!details.hideBankDetails) {
                    // 1. Robust Bank Selection
                    // Logic: Specific Selection (ID or Name) > Default (only if no selection)
                    let selectedBank = null;

                    if (details.bankSelection) {
                        // A. Try finding by ID (Exact Match)
                        selectedBank = bankDetailsMap[details.bankSelection];

                        // B. If not found, try finding by Bank Name (Case-Insensitive)
                        if (!selectedBank) {
                            const searchName = details.bankSelection.trim().toLowerCase();
                            selectedBank = Object.values(bankDetailsMap).find(b =>
                                b.bankName && b.bankName.trim().toLowerCase() === searchName
                            );
                        }
                    } else {
                        // C. No selection provided: Use Default
                        selectedBank = bankDetailsMap['default'];

                        // D. Fallback to first available if no default set
                        if (!selectedBank && Object.keys(bankDetailsMap).length > 0) {
                            const firstKey = Object.keys(bankDetailsMap)[0];
                            selectedBank = bankDetailsMap[firstKey];
                        }
                    }

                    if (selectedBank) {
                        let bankHtml = `
                        <tr>
                            <td colspan="2" style="font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 4px;">Bank Details</td>
                        </tr>
                        <tr><td><strong>Bank Name:</strong></td><td>${selectedBank.bankName || ''}</td></tr>
                        <tr><td><strong>A/c No:</strong></td><td>${selectedBank.accountNumber || ''}</td></tr>
                        <tr><td><strong>IFSC:</strong></td><td>${selectedBank.ifscCode || ''}</td></tr>
                        <tr><td><strong>A/c Holder:</strong></td><td>${selectedBank.accountName || ''}</td></tr>
                    `;

                        // Generate QR Code if UPI ID is present
                        // User Request: "if we select a bank then this bank qr code... will show"
                        // Also: "add total amount in upd qr code"
                        if (selectedBank.upiId) {
                            try {
                                // Format: upi://pay?pa=<UPI_ID>&pn=<ACCOUNT_NAME>&cu=INR
                                let upiString = `upi://pay?pa=${selectedBank.upiId}&pn=${encodeURIComponent(selectedBank.accountName || '')}&cu=INR`;

                                // Always add amount if available (User requested specifically)
                                // Ensure amount is parsed correctly (removing commas)
                                if (doc.totals && doc.totals.grandTotal) {
                                    const totalAmount = parseFloat(String(doc.totals.grandTotal).replace(/,/g, ''));
                                    if (!isNaN(totalAmount) && totalAmount > 0) {
                                        upiString += `&am=${totalAmount.toFixed(2)}`;
                                        if (docNum) {
                                            upiString += `&tn=${encodeURIComponent(docNum)}`;
                                        }
                                    }
                                } const qrDataUrl = await QRCode.toDataURL(upiString, {
                                    errorCorrectionLevel: 'M',
                                    margin: 1,
                                    width: 100,
                                    color: {
                                        dark: '#000000',
                                        light: '#ffffff'
                                    }
                                });

                                // Inject QR Image into Bank Details (Side-by-side layout)
                                bankHtml = `
                                <tr>
                                    <td colspan="2" style="font-weight: bold; border-bottom: 1px solid var(--invoice-border-color); padding-bottom: 4px; margin-bottom: 4px;">Bank Details</td>
                                </tr>
                                <tr>
                                    <td style="vertical-align: top;">
                                        <table cellspacing="0" cellpadding="2" style="width: 100%; font-size: 10px;">
                                            <tr><td style="width: 70px;"><strong>Bank Name:</strong></td><td>${selectedBank.bankName || ''}</td></tr>
                                            <tr><td><strong>A/c No:</strong></td><td>${selectedBank.accountNumber || ''}</td></tr>
                                            <tr><td><strong>IFSC:</strong></td><td>${selectedBank.ifscCode || ''}</td></tr>
                                            <tr><td><strong>A/c Holder:</strong></td><td>${selectedBank.accountName || ''}</td></tr>
                                        </table>
                                    </td>
                                    ${qrDataUrl ? `
                                    <td style="vertical-align: top; text-align: right; width: 100px;">
                                        <img src="${qrDataUrl}" style="width: 80px; height: 80px;" alt="UPI QR">
                                        <div style="font-size: 8px; text-align: center; margin-top: 2px;">Pay using UPI</div>
                                    </td>
                                    ` : ''}
                                </tr>
                            `;
                            } catch (qrErr) {
                                console.error('[PDF Generator] QR Generation Failed:', qrErr);
                            }
                        }

                        // Inject into .bankInfo
                        const $bankInfo = $('.bankInfo');
                        if ($bankInfo.length > 0) {
                            $bankInfo.find('tbody').html(bankHtml);
                            $bankInfo.css('display', 'table');
                        }
                    }
                }

                const pageHtml = $.html();
                if (fullPageHtml) { fullPageHtml += `<div style="page-break-before: always;"></div>${pageHtml}`; }
                else { fullPageHtml = pageHtml; }
            }
        }

        // Wrap in full document structure if needed and enforce white background globally
        if (!fullPageHtml.includes('<body')) {
            fullPageHtml = `<!DOCTYPE html><html><body>${fullPageHtml}</body></html>`;
        }

        // Inject global white background override at the document level
        const backgroundOverrideStyle = `
        <style>
            @media print {
                body, html, .page-copy-container-wrapper, .page-copy-container-wrapper-letter {
                    background-color: #ffffff !important;
                    background: #ffffff !important;
                }
            }
        </style>
    `;

        // Insert the style just before closing </head> or after opening <html>
        if (fullPageHtml.includes('</head>')) {
            fullPageHtml = fullPageHtml.replace('</head>', `${backgroundOverrideStyle}</head>`);
        } else if (fullPageHtml.includes('<html>')) {
            fullPageHtml = fullPageHtml.replace('<html>', `<html><head>${backgroundOverrideStyle}</head>`);
        }

        return await convertHtmlToPdf(fullPageHtml, {
            format: printSize === 'Thermal-2inch' || printSize === 'Thermal-3inch' ? 'A4' : printSize,
            landscape: orientation === 'landscape',
            printBackground: true,
            width: 800,
            scale: 0.95,
            margin: { top: '0', right: '0', bottom: '0', left: '0' }
        });
    } catch (err) {
        console.error('[PDF Generator] Critical Execution Error:', err);
        throw err;
    }
};

module.exports = { generateSaleInvoicePDF };