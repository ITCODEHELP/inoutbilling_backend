const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const mongoose = require('mongoose');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');
const PrintOptions = require('../models/Setting-Model/PrintOptions');
const GeneralSettings = require('../models/Setting-Model/GeneralSetting');
const User = require('../models/User-Model/User');

/**
 * Centralized Template Mapping
 */
const TEMPLATE_MAP = {
    'Default': 'saleinvoicedefault.html',
    'Designed': 'saleinvoicedefault.html',
    'Letterpad': 'saleinvoicedefault.html',
    'Template-1': 'saleinvoice_1.html',
    'Template-2': 'saleinvoice_2.html',
    'Template-3': 'saleinvoice_3.html',
    'Template-4': 'saleinvoice_4.html',
    'Template-5': 'saleinvoice_5.html',
    'Template-6': 'saleinvoice_6.html',
    'Template-7': 'saleinvoice_7.html',
    'Template-8': 'saleinvoice_8.html',
    'Template-9': 'saleinvoice_9.html',
    'Template-10': 'saleinvoice_10.html',
    'Template-11': 'saleinvoice_11.html',
    'Template-12': 'saleinvoice_12.html',
    'Template-13': 'saleinvoice_13.html',
    'A5-Default': 'saleinvoice_A5_1.html',
    'A5-Designed': 'saleinvoice_A5_2_1.html',
    'A5-Letterpad': 'saleinvoice_A5_3_1.html',
    'Template-A5-4': 'saleinvoice_A5_4_1.html',
    'Template-A5-5': 'saleinvoice_A5_5_1.html',
    'Thermal-2inch': 'saleinvoice_thermal_1.html',
    'Thermal-3inch': 'saleinvoice_thermal_2.html',
    'Thermal-4inch': 'saleinvoice_thermal_3.html',
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
            if (actualId && mongoose.Types.ObjectId.isValid(actualId)) {
                printSettings = await PrintOptions.findOne({ userId: actualId }).lean() || {};
            }
        } catch (e) {
            console.error('[PDF Generator] PrintOptions fetch failed:', e);
            printSettings = {};
        }

        // 4. Resolve Branding Images (Uses DB _id)
        brandingAssets = await resolveBrandingImages(actualId);

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
                        *:not(.page-wrapper):not(.page-content):not(.branding-footer-image):not(.branding-signature-image) {
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
                        $(selector).text(titleToUse);
                        titleInjected = true;
                    }
                }

                if (shouldShowTitle) {
                    $('.copyname').text('');
                    // Clean templates that have hardcoded default titles
                    $('#headersec h3, .page-header h3').each(function () {
                        const txt = $(this).text().trim().toUpperCase();
                        const defaults = ['TAX INVOICE', 'DEBIT NOTE', 'CREDIT NOTE', 'QUOTATION', 'SALE INVOICE', 'PROFORMA INVOICE', 'DELIVERY CHALLAN', 'PURCHASE ORDER', 'SALE ORDER', 'PURCHASE INVOICE', 'JOB WORK', 'PACKING LIST'];
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
                    const brandingHtml = generateGlobalHeader(headerLeftData, headerRightData, logoSrc);
                    const wrapper = $('.page-wrapper').length > 0 ? $('.page-wrapper') : $('body');
                    if (shouldShowTitle) { wrapper.prepend(generateTitleSection(titleToUse, copyLabel)); }
                    wrapper.prepend(brandingHtml);
                } else if (shouldShowTitle) {
                    const wrapper = $('.page-wrapper').length > 0 ? $('.page-wrapper') : $('body');
                    wrapper.prepend(generateTitleSection(titleToUse, copyLabel));
                }

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

                // Items Table
                const $tbody = $('#billdetailstbody tbody');
                const $rowTemplate = $tbody.find('tr').first().clone();
                $tbody.empty();
                if (doc.items) {
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
                    $('.footer-total-qty').text((doc.items || []).reduce((sum, item) => sum + (Number(item.qty) || 0), 0).toFixed(2));
                    $('._footer_total').text((doc.totals.grandTotal || 0).toFixed(2));
                    $('.amount_in_words').text(doc.totals.totalInWords || "");
                }
                $('.footer_seal_name').text(`For ${user.companyName || "Company"}`);

                const pageHtml = $.html();
                if (fullPageHtml) { fullPageHtml += `<div style="page-break-before: always;"></div>${pageHtml}`; }
                else { fullPageHtml = pageHtml; }
            }
        }

        // Final Document Structure
        if (!fullPageHtml.includes('<body')) { fullPageHtml = `<!DOCTYPE html><html><body>${fullPageHtml}</body></html>`; }
        const backgroundOverrideStyle = `<style>@media print { body, html, .page-copy-container-wrapper, .page-copy-container-wrapper-letter { background-color: #ffffff !important; background: #ffffff !important; } }</style>`;
        if (fullPageHtml.includes('</head>')) { fullPageHtml = fullPageHtml.replace('</head>', `${backgroundOverrideStyle}</head>`); }
        else if (fullPageHtml.includes('<html>')) { fullPageHtml = fullPageHtml.replace('<html>', `<html><head>${backgroundOverrideStyle}</head>`); }

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