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

/**
 * Centralized Template Mapping
 */
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

/**
 * Resolves template filename and validates existence
 */
const resolveTemplateFile = (templateName) => {
    const filename = TEMPLATE_MAP[templateName] || 'saleinvoicedefault.html';
    const fullPath = path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', filename);

    if (!fs.existsSync(fullPath)) {
        console.warn(`[PDF Generator] Template file NOT found at: ${fullPath}. Falling back to default.`);
        return path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', 'saleinvoicedefault.html');
    }
    return fullPath;
};

const generateGlobalHeader = (businessData, userData, overrideLogoPath) => {
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
            <div style="
                text-align: right;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 9px;
                color: #333333;
                line-height: 1.4;
                min-width: 160px;
            ">
                <div><strong>Name:</strong> ${userData.fullName || businessData.fullName || userData.name || ''}</div>
                <div><strong>Phone:</strong> ${userData.displayPhone || userData.phone || ''}</div>
                <div><strong>Email:</strong> ${userData.email || businessData.email || ''}</div>
                ${((businessData.showPan || userData.showPan) && userData.pan) ? `<div><strong>PAN:</strong> ${userData.pan}</div>` : ''}
            </div>
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
const generateTitleSection = (docType, copyLabel) => {
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
            ">${docType.toUpperCase()}</div>
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
 * Main PDF Generation Logic using Puppeteer
 */
const generateSaleInvoicePDF = async (documents, user, options = { original: true }, docType = 'Sale Invoice', printConfig = { selectedTemplate: 'Default', printSize: 'A4', printOrientation: 'Portrait' }) => {
    const docList = Array.isArray(documents) ? documents : [documents];

    let fullUser = {};
    let businessData = {};
    let printSettings = {};
    let docOptionsData = {};

    // Header Data Objects (Strict Separation)
    let headerLeftData = {};
    let headerRightData = {};
    let brandingAssets = { logo: null, background: null, footer: null, signature: null };

    // --- ROBUST HEADER DATA FETCHING ---
    // Defined outside try-catch to ensure availability in the loop
    let bankDetailsMap = {};

    try {
        const rawUserId = user.userId || user._id;

        // 1. Resolve actual user profile (Check both String and ObjectId)
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

        // 2. Fetch Business Credentials (String userId usually)
        if (actualUserIdString) {
            try {
                businessData = await Business.findOne({ userId: actualUserIdString }).lean() || {};
            } catch (e) {
                console.error('[PDF Generator] Business fetch failed:', e);
                businessData = {};
            }
        }

        // 3. Fetch Print Settings (ObjectId)
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

        // --- SHARED HEADER DATA BUILDER (Strict Mapping & Safe Defaults) ---
        // Merge User and Business data for contact details as some users store Name/Email in Business table
        headerLeftData = {
            companyName: businessData.companyName || fullUser.companyName || '',
            address: businessData.address || fullUser.address || '',
            city: businessData.city || fullUser.city || '',
            state: businessData.state || fullUser.state || '',
            pincode: businessData.pincode || fullUser.pincode || '',
            gstin: businessData.gstin || fullUser.gstin || '',
            businessLogo: brandingAssets.logo || '' // Mandatory Global Source
        };

        headerRightData = {
            fullName: fullUser.fullName || businessData.fullName || fullUser.name || '',
            email: fullUser.email || businessData.email || '',
            phone: fullUser.displayPhone || fullUser.phone || '',
            pan: null
        };

        // Conditional PAN Logic
        if (printSettings?.headerPrintSettings?.showPan) {
            if (fullUser.pan) {
                headerRightData.pan = fullUser.pan;
            }
        }

    } catch (error) {
        console.error('[PDF Generator] Critical error in header builder:', error);
        headerLeftData = headerLeftData && Object.keys(headerLeftData).length ? headerLeftData : { companyName: '' };
        headerRightData = headerRightData && Object.keys(headerRightData).length ? headerRightData : { fullName: '' };
    }

    // Support legacy string templateName or new config object
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

    // Converted to for...of loop to support async/await for QR Code generation
    for (const [docIdx, doc] of docList.entries()) {
        for (const [copyIdx, copyType] of copies.entries()) {
            const $ = cheerio.load(baseHtml);

            // --- PRINT CSS OVERRIDE: PRESERVE BRANDING BUT PREVENT PAGE BREAKS ---
            $('head').append(`
                <style>
                    @media print {
                        /* Strip most backgrounds but preserve branding */
                        *:not(.page-wrapper):not(.page-content):not(.branding-footer-image):not(.branding-signature-image) {
                            background-color: transparent !important;
                            box-shadow: none !important;
                        }
                        
                        /* Allow branding background images */
                        .page-wrapper, .page-content {
                            /* Background will be set inline if branding exists */
                        }
                        
                        /* Ensure body and containers don't add extra backgrounds */
                        body, .page-copy-container-wrapper, .page-wrapper-table {
                            background-color: transparent !important;
                        }
                        
                        /* Lock layout width, center content, and prevent page breaks */
                        body { 
                            width: 210mm !important; 
                            margin: 0 auto !important; 
                            padding: 0 !important; 
                        }
                        
                        /* Center the page wrapper */
                        .page-wrapper-table,
                        .page-copy-container-wrapper {
                            margin: 0 auto !important;
                        }
                        
                        /* CRITICAL: Prevent page breaks on ALL key elements */
                        .page-wrapper, 
                        .page-content, 
                        .page-wrapper-tr,
                        .page-wrapper-letter,
                        .page-copy-container-wrapper,
                        .invoice,
                        table,
                        tbody,
                        .branding-footer-image, 
                        .branding-signature-image,
                        .branding-footer-container,
                        .branding-signature-container,
                        .invoiceTotal,
                        .footer_seal_title,
                        .footer_seal_name,
                        .footer_seal_signature,
                        .foot_table_signature {
                            page-break-inside: avoid !important;
                            page-break-before: avoid !important;
                            page-break-after: avoid !important;
                        }
                        
                        /* Force single page layout */
                        html, body {
                            height: auto !important;
                            overflow: visible !important;
                        }
                        
                        /* Ensure branding images render properly */
                        .branding-footer-image, .branding-signature-image {
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                            display: block !important;
                        }
                        
                        * { 
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact; 
                        }
                    }
                </style>
            `);

            // Resolve Logo (Must be done before generating branding HTML)
            // MANDATORY GLOBAL SOURCE: Prioritize GeneralSettings Logo (Base64)
            let logoSrc = brandingAssets.logo;

            // Only allow explicit override from options (e.g. for specific dynamic prints), 
            // but ignore module-level (invoiceDetails.logo) or legacy fields.
            let rawLogoPath = (!logoSrc && options.overrideLogoPath) ? options.overrideLogoPath : '';

            if (rawLogoPath && !logoSrc) {
                if (rawLogoPath.startsWith('http')) {
                    logoSrc = rawLogoPath;
                } else if (rawLogoPath.startsWith('data:image')) {
                    logoSrc = rawLogoPath;
                } else {
                    try {
                        let logoPath = path.resolve(rawLogoPath);
                        if (!fs.existsSync(logoPath)) {
                            // Try resolving relative to various possible roots
                            const pathsToTry = [
                                path.join(__dirname, '..', rawLogoPath),
                                path.join(__dirname, '..', '..', rawLogoPath),
                                path.join(process.cwd(), rawLogoPath),
                                path.join(process.cwd(), 'backend', rawLogoPath),
                                path.join(process.cwd(), 'uploads', 'business_logos', rawLogoPath),
                                path.join(process.cwd(), 'backend', 'uploads', 'business_logos', rawLogoPath)
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
                            logoSrc = `data:image/${ext};base64,${bitmap.toString('base64')}`;
                        }
                    } catch (e) {
                        console.error('[PDF Generator] Logo resolution error:', e);
                    }
                }
            }

            // Map copy type to proper label
            const copyLabels = {
                'original': 'ORIGINAL FOR RECIPIENT',
                'duplicate': 'DUPLICATE COPY',
                'transport': 'DUPLICATE FOR TRANSPORTER',
                'office': 'TRIPLICATE FOR SUPPLIER'
            };
            const copyLabel = copyLabels[copyType] || `${copyType.toUpperCase()} COPY`;

            // Determine Title
            // Priority: Options Override > Document Options (DB) > Default 'SALE INVOICE'
            const resolvedDocumentTitle = docOptionsData.title || options.titleLabel || (docType === 'Sale Invoice' ? 'SALE INVOICE' : docType.toUpperCase());
            const titleToUse = resolvedDocumentTitle;

            // Check if template requires title section (templates 5-11)
            const templatesWithTitle = ['Template-5', 'Template-6', 'Template-7', 'Template-8', 'Template-9', 'Template-10', 'Template-11'];
            const shouldShowTitle = templatesWithTitle.includes(templateName);

            // --- INJECT DATA INTO EXISTING TEMPLATE HEADER ---
            // We favor populating the template's own elements to respect its structure.

            // 1. SET DOCUMENT INFO
            $('.invoice-title').text(titleToUse);

            if (shouldShowTitle) {
                $('.copyname').text('');
                $('#headersec h3, .page-header h3').each(function () {
                    if ($(this).text().trim() === 'TAX INVOICE') {
                        $(this).text('');
                    }
                });
            } else {
                $('.copyname').text(copyLabel);
            }

            // 2. POPULATE BRANDING (Populate existing template elements if present)
            // LEFT SECTION: Business Details
            $('.org_orgname, .company_name_org').text(headerLeftData.companyName || "").css('text-align', 'left');

            let addressHtml = headerLeftData.address || "";
            if (headerLeftData.city || headerLeftData.state || headerLeftData.pincode) {
                addressHtml += `<br>${headerLeftData.city || ""}, ${headerLeftData.state || ""} - ${headerLeftData.pincode || ""}`;
            }
            if (headerLeftData.gstin) {
                addressHtml += `<br><strong>GSTIN:</strong> ${headerLeftData.gstin}`;
            }
            $('.org_address, .company_address_org').html(addressHtml).css('text-align', 'left');

            // RIGHT SECTION: User Contact Details (Include labels to prevent them being wiped)
            $('.org_contact_name, .company_contact_name').html(headerRightData.fullName ? `<b>Name</b> : ${headerRightData.fullName}` : "").css('text-align', 'right');
            $('.org_phone').html(headerRightData.phone ? `<b>Phone</b> : ${headerRightData.phone}` : "").css('text-align', 'right');

            // Handle Email Injection (Append row if missing)
            if (headerRightData.email) {
                if ($('.org_email').length > 0) {
                    $('.org_email').html(`<b>Email</b> : ${headerRightData.email}`).css('text-align', 'right').css('display', 'block');
                } else {
                    const $phoneRow = $('.org_phone').closest('tr');
                    const $tbody = $phoneRow.parent();
                    if ($tbody.length > 0) {
                        $tbody.append(`<tr><td class="contact_details org_email" style="text-align: right;"><b>Email</b> : ${headerRightData.email}</td></tr>`);
                    }
                }
            }

            // Handle PAN Injection (Append row if missing)
            if (headerRightData.pan) {
                if ($('.org_pan_row').length > 0) {
                    $('.org_pan_row').html(`<b>PAN</b> : ${headerRightData.pan}`).css('text-align', 'right');
                } else {
                    const $phoneRow = $('.org_phone').closest('tr');
                    const $tbody = $phoneRow.parent();
                    if ($tbody.length > 0) {
                        $tbody.append(`<tr><td class="contact_details org_pan_row" style="text-align: right;"><b>PAN</b> : ${headerRightData.pan}</td></tr>`);
                    }
                }
            }

            // Explicitly hide redundant contact fields in blue-box area if they exist
            $('.company_contact_no, .company_email').css('display', 'none');

            // Handle Logo Substitution
            if (logoSrc) {
                const logoSelectors = [
                    '.company-logo',
                    '.business-logo',
                    '.org_logo',
                    '#logo',
                    '.logo img',
                    'img[alt*="logo" i]',
                    'img[src*="logo" i]',
                    '.company_name_org img'
                ];

                let logoReplaced = false;
                for (const selector of logoSelectors) {
                    if ($(selector).length > 0) {
                        $(selector).attr('src', logoSrc);
                        logoReplaced = true;
                    }
                }

                // If no logo placeholder found but we have a company name anchor, prepend it and ensure side-by-side layout (Logo Left, Details Right)
                if (!logoReplaced && ($('.org_orgname, .company_name_org').length > 0)) {
                    const $anchor = $('.org_orgname, .company_name_org').first();
                    const $target = $anchor.closest('table').length > 0 ? $anchor.closest('table') : $anchor;

                    $target.wrap('<div class="branding-flex-container" style="display: flex; align-items: flex-start; gap: 15px; text-align: left;"></div>');
                    $target.before(`<img src="${logoSrc}" class="company-logo business-logo" alt="Logo" style="max-height: 70px; max-width: 200px; object-fit: contain; flex-shrink: 0;">`);
                }
            }

            // Handle Background Injection
            if (brandingAssets.background) {
                // Background applied as fixed position overlay - doesn't affect layout
                $('head').append(`
                    <style>
                        body::before {
                            content: "";
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background-image: url("${brandingAssets.background}") !important;
                            background-size: cover !important;
                            background-position: center !important;
                            background-repeat: no-repeat !important;
                            z-index: -1;
                            pointer-events: none;
                        }
                    </style>
                `);
            }

            // Handle Footer Injection - using fixed position to prevent overflow
            if (brandingAssets.footer) {
                $('head').append(`
                    <style>
                        body::after {
                            content: "";
                            position: fixed;
                            bottom: 0;
                            left: 0;
                            width: 100%;
                            height: 60px;
                            background-image: url("${brandingAssets.footer}") !important;
                            background-size: contain !important;
                            background-position: center bottom !important;
                            background-repeat: no-repeat !important;
                            z-index: -1;
                            pointer-events: none;
                        }
                    </style>
                `);
            }

            // Handle Signature Injection
            if (brandingAssets.signature) {
                // Priority order: blank space in foot_table_signature > footer_seal_signature > footer_seal_name > fallback
                if ($('.foot_table_signature td').length > 0) {
                    // This is the blank space between "For Company" and "Authorised Signatory"
                    $('.foot_table_signature td').html(`<img src="${brandingAssets.signature}" class="branding-signature-image" style="max-height: 40px; max-width: 150px; display: block; margin: 0 auto; object-fit: contain; page-break-inside: avoid;">`);
                } else if ($('.footer_seal_signature').length > 0) {
                    // Fallback to dedicated signature area
                    $('.footer_seal_signature').html(`<img src="${brandingAssets.signature}" class="branding-signature-image" style="max-height: 35px; max-width: 120px; display: block; margin: 0 auto; object-fit: contain; page-break-inside: avoid;">`);
                } else if ($('.footer_seal_name').length > 0) {
                    // Some templates use seal name area
                    $('.footer_seal_name').prepend(`<img src="${brandingAssets.signature}" class="branding-signature-image" style="max-height: 50px; max-width: 150px; display: block; margin: 0 auto 5px; object-fit: contain; page-break-inside: avoid;">`);
                } else if ($('.page-footer').length > 0) {
                    // If no seal area but footer exists, add to footer
                    $('.page-footer').prepend(`<div style="text-align: right; margin-bottom: 5px; page-break-inside: avoid;"><img src="${brandingAssets.signature}" class="branding-signature-image" style="max-height: 50px; max-width: 150px; object-fit: contain;"></div>`);
                } else {
                    // Fallback: add signature before footer or at end of page wrapper
                    const signatureHtml = `<div class="branding-signature-container" style="text-align: right; margin-top: 10px; margin-bottom: 5px; page-break-inside: avoid;"><img src="${brandingAssets.signature}" class="branding-signature-image" style="max-height: 50px; max-width: 150px; object-fit: contain;"></div>`;
                    if ($('.branding-footer-container').length > 0) {
                        $('.branding-footer-container').before(signatureHtml);
                    } else if ($('.page-wrapper').length > 0) {
                        $('.page-wrapper').append(signatureHtml);
                    } else {
                        $('body').append(signatureHtml);
                    }
                }
            }

            // --- OPTIONAL INJECTION (Only if template is bare) ---
            if ($('.org_orgname').length === 0 && $('.branding').length === 0) {
                const brandingHtml = generateGlobalHeader(headerLeftData, headerRightData, logoSrc);

                if (shouldShowTitle) {
                    const titleSectionHtml = generateTitleSection(titleToUse, copyLabel);
                    if ($('.page-wrapper').length > 0) {
                        $('.page-wrapper').prepend(titleSectionHtml);
                        $('.page-wrapper').prepend(brandingHtml);
                    } else {
                        $('body').prepend(titleSectionHtml);
                        $('body').prepend(brandingHtml);
                    }
                } else {
                    if ($('.page-wrapper').length > 0) {
                        $('.page-wrapper').prepend(brandingHtml);
                    } else {
                        $('body').prepend(brandingHtml);
                    }
                }
            } else if (shouldShowTitle) {
                const titleSectionHtml = generateTitleSection(titleToUse, copyLabel);
                // Just inject Title box if needed, branding already handled by population above
                if ($('.page-wrapper').length > 0) {
                    $('.page-wrapper').prepend(titleSectionHtml);
                } else {
                    $('body').prepend(titleSectionHtml);
                }
            }

            // --- 2. SET DOCUMENT INFO ---
            $('.invoice-title').text(titleToUse);

            if (shouldShowTitle) {
                $('.copyname').text('');
                $('#headersec h3').each(function () {
                    if ($(this).text().trim() === 'TAX INVOICE') {
                        $(this).text('');
                    }
                });
            } else {
                $('.copyname').text(copyLabel);
            }

            // Customer Info
            if (doc.customerInformation) {
                $('.company_name .special').text(doc.customerInformation.ms || "");
                $('.company_address td:last-child div').text(doc.customerInformation.address || "");
                $('.cmp_gstno').text(doc.customerInformation.gstinPan || "");
            }

            // Invoice Info
            const details = doc.invoiceDetails || doc.quotationDetails || doc.deliveryChallanDetails || doc.proformaDetails || doc.creditNoteDetails || {};
            const docNum = options.numValue || details.invoiceNumber || details.quotationNumber || details.challanNumber || details.proformaNumber || details.cnNumber || "";
            const docDate = options.dateValue || (details.date || details.cnDate ? new Date(details.date || details.cnDate).toLocaleDateString() : "");

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

            // Items Table
            const $tbody = $('#billdetailstbody tbody');
            const $rowTemplate = $tbody.find('tr').first().clone();
            $tbody.empty();

            if (doc.items && Array.isArray(doc.items)) {
                doc.items.forEach((item, index) => {
                    const $row = $rowTemplate.clone();
                    $row.find('.td-body-sr-no').text(index + 1);
                    $row.find('.td-body-product-name b').text(item.productName || item.productDescription || "N/A");
                    $row.find('.td-body-hsn-sac').text(item.hsnSac || "");
                    $row.find('.td-body-qty').text(item.qty || 0);
                    $row.find('.td-body-rate').text((Number(item.price) || 0).toFixed(2));
                    $row.find('.td-body-item-total').text((Number(item.total) || 0).toFixed(2));
                    $tbody.append($row);
                });
            }

            // Totals
            if (doc.totals) {
                const totalQty = (doc.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
                $('.footer-total-qty').text(totalQty.toFixed(2));
                $('._footer_total').text((doc.totals.grandTotal || 0).toFixed(2));
                $('.amount_in_words').text(doc.totals.totalInWords || "");
            }
            $('.footer_seal_name').text(`For ${user.companyName || "Company"}`);

            // --- BANK DETAILS & QR CODE INJECTION ---
            if (!invoiceDetails.hideBankDetails) {
                // 1. Robust Bank Selection
                // Logic: Specific Selection > Default > First Available
                let selectedBank = null;

                // Try finding by selection key (which might be bankId or _id)
                if (invoiceDetails.bankSelection) {
                    selectedBank = bankDetailsMap[invoiceDetails.bankSelection];
                }

                // Fallback to default if not found or not selected
                if (!selectedBank) {
                    selectedBank = bankDetailsMap['default'];
                }

                // Fallback to first available bank if still no bank
                if (!selectedBank && Object.keys(bankDetailsMap).length > 0) {
                    // Get the first bank in the map
                    const firstKey = Object.keys(bankDetailsMap)[0];
                    selectedBank = bankDetailsMap[firstKey];
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
                            if (doc.totals && doc.totals.grandTotal) {
                                upiString += `&am=${parseFloat(doc.totals.grandTotal).toFixed(2)}`;
                                if (docNum) {
                                    upiString += `&tn=${encodeURIComponent(docNum)}`;
                                }
                            }

                            const qrDataUrl = await QRCode.toDataURL(upiString, {
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
                                    <td colspan="2" style="font-weight: bold; border-bottom: 1px solid #0070c0; padding-bottom: 4px; margin-bottom: 4px;">Bank Details</td>
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
                                        <div style="font-size: 8px; text-align: center; margin-top: 2px;">Scan to Pay</div>
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

            // Prepare for multi-page rendering
            const pageHtml = $.html();
            if (fullPageHtml) {
                fullPageHtml += `<div style="page-break-before: always;"></div>${pageHtml}`;
            } else {
                fullPageHtml = pageHtml;
            }
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

    // Force rendering with high-fidelity layout parameters to prevent line breaks
    return await convertHtmlToPdf(fullPageHtml, {
        format: printSize === 'Thermal-2inch' || printSize === 'Thermal-3inch' ? 'A4' : printSize,
        landscape: orientation === 'landscape',
        printBackground: true,
        width: 800, // Force match to template layout width
        scale: 0.95, // Re-apply 0.95 scaling for single-page fit
        margin: { top: '0', right: '0', bottom: '0', left: '0' } // Clear default margins
    });
};

module.exports = { generateSaleInvoicePDF };