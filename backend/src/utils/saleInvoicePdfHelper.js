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

const pathToBase64 = (rawPath) => {
    if (!rawPath) return null;
    if (rawPath.startsWith('http') || rawPath.startsWith('data:image')) return rawPath;
    try {
        let fullPath = path.resolve(rawPath);
        if (!fs.existsSync(fullPath)) {
            const pathsToTry = [
                path.join(process.cwd(), rawPath),
                path.join(process.cwd(), 'backend', rawPath),
                path.join(__dirname, '..', '..', rawPath),
                path.join(__dirname, '..', rawPath),
                path.join(process.cwd(), 'src', rawPath),
                path.join(process.cwd(), 'backend', 'src', rawPath)
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
            return `data:image/${ext};base64,${bitmap.toString('base64')}`;
        }
    } catch (e) {
        console.error(`[PDF Generator] Error resolving image path: ${rawPath}`, e);
    }
    return null;
};

const generateHsnSummary = (items) => {
    const summary = {};
    items.forEach(item => {
        const hsn = item.hsnSac || 'Others';
        if (!summary[hsn]) {
            summary[hsn] = { hsn, taxableValue: 0, igst: 0, cgst: 0, sgst: 0, totalTax: 0 };
        }
        const qty = Number(item.qty) || 0;
        const rate = Number(item.price) || Number(item.rate) || 0;
        const discValue = Number(item.discountValue || item.discount || item.disc || 0);

        // Use pre-calculated taxableValue if available, otherwise calculate
        const taxable = item.taxableValue !== undefined ? Number(item.taxableValue) : ((qty * rate) - discValue);

        const iRate = Number(item.igst || 0);
        const cRate = Number(item.cgst || 0);
        const sRate = Number(item.sgst || 0);

        summary[hsn].taxableValue += taxable;

        if (iRate > 0) {
            const iAmt = Number(item.igstAmount || (taxable * (iRate / 100)) || 0);
            summary[hsn].igst += iAmt;
            summary[hsn].totalTax += iAmt;
        } else {
            const caurate = Number(item.cgstAmount || (taxable * (cRate / 100)) || 0);
            const saurate = Number(item.sgstAmount || (taxable * (sRate / 100)) || 0);
            summary[hsn].cgst += caurate;
            summary[hsn].sgst += saurate;
            summary[hsn].totalTax += (caurate + saurate);
        }
    });
    return Object.values(summary);
};

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
    const showPan = headerSettings.showPanNumber !== false;
    const showStaff = headerSettings.showStaffDetailsInHeader === true;
    const showExporter = headerSettings.showExporterDetails !== false;

    // Contact Section Logic
    let contactSection = '';
    if (!hideContact) {
        const phone = userData.displayPhone || userData.phone || businessData.phone;
        const email = userData.email || businessData.email;
        const name = userData.fullName || businessData.fullName || userData.name;

        contactSection = `
            <div style="
                text-align: right;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 9px;
                color: #333333;
                line-height: 1.4;
                min-width: 160px;
            ">
                ${(showStaff && name) ? `<div><strong>Name:</strong> ${name}</div>` : ''}
                ${phone ? `<div><strong>Phone:</strong> ${phone}</div>` : ''}
                ${email ? `<div><strong>Email:</strong> ${email}</div>` : ''}
                ${(showPan && userData.pan) ? `<div><strong>PAN:</strong> ${userData.pan}</div>` : ''}
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
                branding[key] = pathToBase64(rawPath);
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
        if (typeof val === 'string' && val.trim() === "") return false;
        return true;
    };

    // Check for specific fields
    // Logic: Visible if (Data Exists) AND (Not Hidden in Settings)
    const showHsn = !productSettings.hideHsnColumn && doc.items.some(item => hasValue(item.hsnSac));

    // Qty and Rate are usually always shown, but we check to be safe or if user wants to hide them
    const showQty = !productSettings.hideQuantityColumn && doc.items.some(item => hasValue(item.qty));
    const showRate = !productSettings.hideRateColumn && doc.items.some(item => hasValue(item.price) || hasValue(item.rate));

    // Discount: Show if (NOT hidden in settings) AND (any item has discount data)
    const showDiscount = !productSettings.hideDiscountColumn && doc.items.some(item => hasValue(item.discount) || hasValue(item.disc));


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
                '.disc', '.header-disc', '.td-body-disc', '.td-body-discount',
                '[data-column="5"]', '.header-cur-symbol',
                '.footer-total-disc', '.footer-disc', '.discount-column'
            ]
        },
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

    // 🎯 INJECT DISCOUNT COLUMN IF MISSING
    if (showDiscount && $('.header-disc, .disc, [data-column="5"], .discount-column').length === 0) {
        // Find Rate column to insert after
        const $rateHeader = $('.header-rate, .rate, [data-column="4"]').first();
        if ($rateHeader.length > 0) {
            $rateHeader.after('<td class="valign-mid header-disc discount-column">Disc.</td>');
            $('.td-body-rate').after('<td class="txt-center td-body-disc discount-column"></td>');
            $('col.rate').after('<col class="discount-column" style="width: 8%">');
            // Adjust product name width to compensate
            const $pNameCol = $('col.productname');
            const currentWidth = parseInt($pNameCol.attr('style')?.match(/width:\s*(\d+)%/)?.[1]) || 43;
            $pNameCol.css('width', `${currentWidth - 8}%`);
            // Add background line
            const rateLine = $('.tableboxLine.rate');
            if (rateLine.length > 0) {
                const discLine = rateLine.clone().removeClass('rate').addClass('discount-column').css('width', '8%');
                rateLine.after(discLine);
            }
        }
    }

    // 3. Redistribute Widths
    // Initial widths from Template-Default.html for reference
    const widths = {
        hsnSac: 13,
        qty: 12,
        rate: 14,
        discount: 8
    };

    let removedWidth = 0;
    colConfig.forEach(col => {
        if (!col.visible) {
            removedWidth += (widths[col.key] || 0);
            col.selectors.forEach(selector => {
                $(selector).remove();
            });
        }
    });

    if (removedWidth > 0) {
        const $productNameCol = $('col.productname');
        if ($productNameCol.length > 0) {
            const currentWidth = parseInt($productNameCol.attr('style')?.match(/width:\s*(\d+)%/)?.[1]) || 43;
            $productNameCol.css('width', `${currentWidth + removedWidth}%`);
            // Also update background line widths if necessary
            $('.tableboxLine.productname').css('width', `${currentWidth + removedWidth}%`);

            // Recalculate 'left' positions for background lines
            let currentLeft = 0;
            $('col').each(function () {
                const colClass = $(this).attr('class');
                const colWidthStr = $(this).attr('style')?.match(/width:\s*(\d+)%/)?.[1];
                if (colWidthStr) {
                    const colWidth = parseInt(colWidthStr);
                    $(`.tableboxLine.${colClass}`).css('left', `${currentLeft}%`);
                    currentLeft += colWidth;
                }
            });
        }
    }

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

        // 1. Resolve actual user profile (Check both User and Staff collections)
        try {
            const searchId = rawUserId;
            const isOid = mongoose.Types.ObjectId.isValid(searchId);

            fullUser = await User.findOne({
                $or: [
                    { userId: searchId },
                    { _id: isOid ? searchId : null }
                ].filter(q => q._id !== null || q.userId)
            }).lean();

            if (!fullUser) {
                const Staff = require('../models/Setting-Model/Staff');
                fullUser = await Staff.findOne({
                    $or: [
                        { userId: searchId },
                        { _id: isOid ? searchId : null }
                    ].filter(q => q._id !== null || q.userId)
                }).lean();
                if (fullUser) {
                    fullUser._isStaff = true;
                }
            }

            if (!fullUser) fullUser = user;
        } catch (e) {
            console.error('[PDF Generator] User/Staff fetch failed:', e);
            fullUser = user;
        }

        // 🎯 RESOLVE SETTINGS OWNER (If Staff, use OwnerRef)
        const settingsOwnerId = fullUser.ownerRef || fullUser._id || rawUserId;

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

        // 3. Fetch Print Settings (Uses Settings Owner ID)
        try {
            if (settingsOwnerId && mongoose.Types.ObjectId.isValid(settingsOwnerId)) {
                printSettings = await PrintOptions.findOne({ userId: settingsOwnerId }).lean() || {};
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

        const pHeader = printSettings?.headerPrintSettings || {};
        const showStaff = pHeader.showStaffDetailsInHeader === true;
        const showPan = pHeader.showPanNumber !== false;

        headerRightData = {
            fullName: showStaff ? (fullUser.fullName || businessData.fullName || fullUser.name || '') : '',
            email: fullUser.email || businessData.email || '',
            phone: fullUser.displayPhone || fullUser.phone || businessData.phone || '',
            pan: (showPan && (fullUser.pan || businessData.pan)) ? (fullUser.pan || businessData.pan) : null
        };

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

                const $emailEl = $('.org_email');
                if (headerRightData.email) {
                    if ($emailEl.length > 0) { $emailEl.html(`<b>Email</b> : ${headerRightData.email}`).css('text-align', 'right'); }
                    else { $('.org_phone').closest('tr').parent().append(`<tr><td class="contact_details org_email" style="text-align: right;"><b>Email</b> : ${headerRightData.email}</td></tr>`); }
                } else {
                    $emailEl.remove(); // Remove if empty to keep it perfect
                }

                const $panEl = $('.org_pan_row');
                if (headerRightData.pan) {
                    if ($panEl.length > 0) { $panEl.html(`<b>PAN</b> : ${headerRightData.pan}`).css('text-align', 'right'); }
                    else { $('.org_phone').closest('tr').parent().append(`<tr><td class="contact_details org_pan_row" style="text-align: right;"><b>PAN</b> : ${headerRightData.pan}</td></tr>`); }
                } else {
                    $panEl.remove();
                }

                // Force population if template fields are empty but data exists
                if ($('.org_orgname').length > 0 && !$('.org_orgname').text().trim()) {
                    $('.org_orgname').text(headerLeftData.companyName || "");
                }
                if ($('.org_address').length > 0 && !$('.org_address').text().trim()) {
                    $('.org_address').html(addressHtml);
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
                if (pHeader.hideContactDetailInHeader) {
                    $('.contact_details, .org_contact_name, .org_phone, .org_email, .org_pan_row').remove();
                }

                // Header/Footer Size Adjustments
                if (pHeader.letterpadHeaderSize) {
                    const size = parseInt(pHeader.letterpadHeaderSize) || 105;
                    $('.page-header').css('min-height', `${size}px`);
                }
                if (pFooter.letterpadFooterSize) {
                    const size = parseInt(pFooter.letterpadFooterSize) || 100;
                    $('.page-footer').css('min-height', `${size}px`);
                }

                // 2. Customer & Document Rules
                if (pCust.hideDueDate) {
                    $('.extra_field:contains("Due Date")').remove();
                }
                if (pCust.hideTransport) {
                    $('.transport_documents, .transport_name, .transport_detail').remove();
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
                if (pCust.printShipToDetails === false) {
                    $('.shipping_label, .shipping_name, .shipping_address, .shipping_country, .shipping_phone, .shipping_gstin, .shipping_state').remove();
                    // Also find tables that are purely for shipping and remove them
                    $('.customerdata:contains("Shipped to"), .customerdata:contains("Consignee")').remove();
                    // If shipping is removed, broaden the buyer column if possible
                    $('.customerdata:contains("Buyer")').closest('td').attr('width', '55%');
                    $('.invoice_details').closest('td').attr('width', '45%');
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
                if (pProduct.hideSrNoColumn) {
                    $('.header-sr-no, .td-body-sr-no, .sr_no, [data-column="0"]').remove();
                    // Adjust colgroup if possible? Hard with cheerio, but removing the cells is a start.
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
                    $('.customer_signature_box, .customer_sign_box').remove();
                }
                if (pFooter.showInvoiceTerms === false) {
                    $('.terms_condition_section, .terms-section, .terms-condition-placeholder').remove();
                }
                if (pFooter.showInvoiceBankDetails === false) {
                    $('.footer_bank_detail, .bank-details-section, .bank-details-placeholder, .bank_details').remove();
                }
                if (pFooter.showFooterImage === false) {
                    $('.branding-footer-image').remove();
                }

                // 🎯 INJECT PAGE NUMBER
                if (pFooter.showPageNumber !== false) {
                    const pageNumHtml = `
                        <div class="page-number-container" style="position: absolute; bottom: 10px; right: 28px; font-size: 8px; color: #777;">
                            Page <span class="page-num">1</span>
                        </div>
                    `;
                    // Inject into each page (if multibody)
                    $('.page-wrapper').each(function () {
                        $(this).append(pageNumHtml);
                    });
                }

                // Bank Details Logic
                if (pFooter.showInvoiceBankDetails !== false) {
                    const bank = await BankDetails.findOne({ userId: fullUser._id, isDefault: true });
                    if (bank) {
                        let bankHtml = `
                            <div class="bank-info-container" style="font-size: 10px; margin-top: 5px; line-height: 1.2;">
                                ${pFooter.showBankLogo && bank.bankLogo ? `<img src="${bank.bankLogo}" style="max-height: 35px; margin-bottom: 3px; display: block;">` : ''}
                                <strong>Bank Details:</strong> <span style="font-size: 9px;">${bank.bankName} | A/c: ${bank.accountNumber} | IFSC: ${bank.ifscCode} | Branch: ${bank.branchName}</span>
                            </div>
                        `;

                        const $bankTarget = $('.footer_bank_detail, .bank-details-placeholder, .bank_details');
                        if ($bankTarget.length > 0) {
                            $bankTarget.html(bankHtml);
                        } else {
                            $('.terms_condition_section').before(bankHtml);
                        }
                    }
                }
                if (pFooter.hideTotalGrossAmount) {
                    $('.total_gross_amount_row, .gross_amount_row').remove();
                }
                if (pFooter.hideSubTotal) {
                    $('.subtotal_row, .subtotal-row').remove();
                }
                if (pFooter.hideTotalTaxAmount) {
                    $('.tax_total_row, .total_tax_row').remove();
                }
                if (pFooter.hideTotalDiscountAmount) {
                    $('.discount_total_row, .footer-total-disc').remove();
                }

                // HSN Summary logic
                if (pFooter.showHsnSummary !== false && doc.items) {
                    const hsnSummaryData = generateHsnSummary(doc.items);
                    const option = pFooter.hsnSummaryOption || 'Default';
                    const hasTax = hsnSummaryData.some(r => r.totalTax > 0);

                    let hsnHtml = `
                        <div class="hsn-summary-container" style="margin-top: 15px; border: 1px solid var(--invoice-border-dynamic); border-radius: 4px; overflow: hidden; page-break-inside: avoid;">
                            <div style="background: var(--invoice-light-blue-bg); padding: 5px 10px; font-weight: bold; font-size: 10px; border-bottom: 1px solid var(--invoice-border-dynamic); color: #333;">HSN / SAC Summary</div>
                            <table class="hsn-summary-table" style="width: 100%; border-collapse: collapse; font-size: 9px;">
                                <thead>
                                    <tr style="background-color: #fcfcfc;">
                                        <th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: left;">HSN/SAC</th>
                                        <th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">Taxable Value</th>
                                        ${option.includes('GST') ? `
                                            <th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">IGST</th>
                                            <th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">CGST</th>
                                            <th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">SGST</th>
                                        ` : ''}
                                        ${option.includes('UOM') ? `<th style="border-right: 1px solid var(--invoice-border-dynamic); border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: center;">UOM</th>` : ''}
                                        ${hasTax ? `<th style="border-bottom: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">Total Tax</th>` : ''}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${hsnSummaryData.map((row, idx) => `
                                        <tr style="${idx === hsnSummaryData.length - 1 ? '' : 'border-bottom: 1px solid #eee;'}">
                                            <td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: left;">${row.hsn}</td>
                                            <td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">${row.taxableValue.toFixed(2)}</td>
                                            ${option.includes('GST') ? `
                                                <td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">${row.igst.toFixed(2)}</td>
                                                <td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">${row.cgst.toFixed(2)}</td>
                                                <td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: right;">${row.sgst.toFixed(2)}</td>
                                            ` : ''}
                                            ${option.includes('UOM') ? `<td style="border-right: 1px solid var(--invoice-border-dynamic); padding: 6px; text-align: center;">${doc.items.find(i => i.hsnSac === row.hsn)?.uom || '-'}</td>` : ''}
                                            ${hasTax ? `<td style="padding: 6px; text-align: right;">${row.totalTax.toFixed(2)}</td>` : ''}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;

                    const $hsnTarget = $('.hsn_summary_section, .hsn-summary-placeholder');
                    if ($hsnTarget.length > 0) {
                        $hsnTarget.html(hsnHtml);
                    } else {
                        // If no specific placeholder, append before any terms or bank info
                        $('.page-footer').prepend(hsnHtml);
                    }
                }
                if (pFooter.footerText) {
                    $('.footer-text').text(pFooter.footerText);
                }
                if (pFooter.customerSignatureLabel) {
                    $('.footer_seal_signature, .signature-label, .customer_signature_label').text(pFooter.customerSignatureLabel);
                }

                // Final check for contact person in header (Branding section)
                if (pHeader.showContactPersonInHeader === false) {
                    $('.org_contact_name').remove();
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

                    // Fix: Populate address without wiping city/state spans
                    const $addrDiv = $('.company_address td:last-child div');
                    if ($addrDiv.length > 0) {
                        const addr = doc.customerInformation.address || "";
                        // If we have distinct city/state in data, we could use them, 
                        // but usually it's one address string.
                        $addrDiv.contents().filter(function () {
                            return this.nodeType === 3; // text nodes
                        }).first().replaceWith(addr + " ");

                        if (pCust.showStateInCustomerDetail === false) {
                            $('.cmp_city, .cmp_state').remove();
                        } else {
                            if (doc.customerInformation.city) $('.cmp_city').text(", " + doc.customerInformation.city);
                            if (doc.customerInformation.state) $('.cmp_state').text(", " + doc.customerInformation.state);
                        }
                    } else {
                        // Fallback
                        $('.company_address td:last-child').text(doc.customerInformation.address || "");
                    }

                    $('.cmp_gstno').text(doc.customerInformation.gstinPan || "");

                    // 🎯 SHOW CONTACT PERSON
                    if (pCust.showContactPerson && doc.customerInformation.contactPerson) {
                        const contactRow = `
                            <tr class="company_contact_person">
                                <td class="customerdata_item_label">Contact</td>
                                <td class="special">${doc.customerInformation.contactPerson}</td>
                            </tr>
                         `;
                        $('.company_name').after(contactRow);
                    }
                }

                // 🎯 SHOW EXPORTER DETAILS
                if (pHeader.showExporterDetails && doc.exporterDetails) {
                    const exporterHtml = `
                        <div class="exporter_details" style="margin: 10px 0; padding: 6px; border: 1px dashed var(--invoice-border-color); font-size: 10px; background: #fafafa;">
                            <strong style="color: #333;">Exporter Details:</strong> ${doc.exporterDetails}
                        </div>
                    `;
                    // More reliable injection points
                    const $headerTable = $('.branding, .header, .page-header').first();
                    if ($headerTable.length > 0) {
                        $headerTable.after(exporterHtml);
                    } else {
                        $('.page-wrapper').prepend(exporterHtml);
                    }
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
                manageDynamicColumns($, doc, printSettings);

                // Items Table
                // Handling for different template structures (Template 1-4 vs 5-11 vs Thermal)
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

                            // Product Name and Image logic
                            let pName = item.productName || item.name || item.productDescription || "N/A";
                            if (pProduct.showProductGroup && item.productGroup) {
                                pName = `<span style="font-size: 80%; color: #666; font-weight: normal;">[${item.productGroup}]</span><br>${pName}`;
                            }
                            let productCellHtml = `<b style="margin: 0; padding: 2px 0; font-size: 11px;">${pName}</b>`;

                            if (item.description) {
                                productCellHtml += `<p style="margin: 0; font-size: 9px; color: #555; line-height: 1.2;">${item.description}</p>`;
                            }

                            // Handle product image location if setting is provided and image exists
                            if (pProduct.productImageLocation && pProduct.productImageLocation !== 'None' && item.productImageUrl) {
                                const resolvedImg = pathToBase64(item.productImageUrl);
                                if (resolvedImg) {
                                    const imgSize = pProduct.productImageLocation.includes('(Large)') ? '80px' : '40px';
                                    const imgHtml = `<img src="${resolvedImg}" style="max-height: ${imgSize}; max-width: ${imgSize}; object-fit: contain; display: block; margin: 4px 0;">`;

                                    if (pProduct.productImageLocation.startsWith('Above')) {
                                        productCellHtml = imgHtml + productCellHtml;
                                    } else if (pProduct.productImageLocation.startsWith('Below')) {
                                        productCellHtml = productCellHtml + imgHtml;
                                    } else if (pProduct.productImageLocation.startsWith('Before')) {
                                        productCellHtml = `<div style="display: flex; align-items: start; gap: 8px;">${imgHtml}<div>${productCellHtml}</div></div>`;
                                    } else if (pProduct.productImageLocation.startsWith('After')) {
                                        productCellHtml = `<div style="display: flex; align-items: start; gap: 8px;"><div>${productCellHtml}</div>${imgHtml}</div>`;
                                    }
                                }
                            }

                            const $pNameCell = $row.find('.td-body-product-name, .productname b, .productname h4').first();
                            if ($pNameCell.length > 0) {
                                if ($pNameCell.is('b') || $pNameCell.is('h4')) {
                                    $pNameCell.parent().html(productCellHtml);
                                } else {
                                    $pNameCell.html(productCellHtml);
                                }
                            }
                            // Ensure the cell has proper alignment and padding
                            $row.find('.td-body-product-name, .productname').css({
                                'padding': '6px 8px',
                                'vertical-align': 'top'
                            });

                            // Helper to safely set text if element exists (it might have been removed by dynamic logic)
                            const setText = (selector, val) => {
                                if ($row.find(selector).length) {
                                    $row.find(selector).text(val);
                                }
                            };

                            setText('.td-body-hsn-sac', item.hsnSac || "");
                            // Qty with Uom logic
                            let qtyHtml = `${item.qty || 0}`;
                            if (item.uom) {
                                if (pProduct.showUomDifferentColumn) {
                                    qtyHtml += `<br><span style="font-size: 8px; color: #666;">${item.uom}</span>`;
                                } else {
                                    qtyHtml += ` ${item.uom}`;
                                }
                            }
                            setText('.td-body-qty', qtyHtml);
                            if (pProduct.showUomDifferentColumn) {
                                $row.find('.td-body-qty').html(qtyHtml);
                            }
                            setText('.td-body-rate', (Number(item.price) || Number(item.rate) || 0).toFixed(2));

                            // Discount: Handle standard and percentage
                            let discVal = (Number(item.discount) || Number(item.disc) || 0);
                            setText('.td-body-disc', discVal > 0 ? discVal.toFixed(2) : (item.discount !== undefined && item.discount !== null && item.discount !== "" ? item.discount : ""));

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
                    $('.footer-total-qty').text(totalQty.toFixed(2));
                    $('._footer_total').text((doc.totals.grandTotal || 0).toFixed(2));
                    $('.amount_in_words').text(doc.totals.totalInWords || "");

                    // Fix: Update Grand Total in Summary Section (Standard & Thermal Templates)
                    const grandFinal = (doc.totals.grandTotal || 0).toFixed(2);

                    // 🎯 DYNAMIC FOOTER ROWS INJECTION (Subtotal, Tax, RoundOff)
                    const $summaryTable = $('.invoiceTotal tbody, .invoicedataFooter tbody').first();
                    if ($summaryTable.length > 0) {
                        // Clear placeholders if we are going to reconstruct
                        // (Usually it's better to just prepend rows to the summaryTotalRow)
                        const $totalRow = $('._total_amount_after_tax_filed, ._grand_total').first();

                        // 1. Subtotal
                        if (pFooter.hideSubTotal === false && doc.totals.totalTaxable > 0) {
                            $totalRow.before(`
                                <tr class="subtotal_row">
                                    <td class="txt-right">Sub Total</td>
                                    <td class="txt-right special">₹ ${doc.totals.totalTaxable.toFixed(2)}</td>
                                </tr>
                            `);
                        }

                        // 2. Tax Rows
                        if (pFooter.hideTotalTaxAmount === false) {
                            if (doc.totals.totalCGST > 0) {
                                $totalRow.before(`<tr><td class="txt-right">CGST</td><td class="txt-right special">₹ ${doc.totals.totalCGST.toFixed(2)}</td></tr>`);
                            }
                            if (doc.totals.totalSGST > 0) {
                                $totalRow.before(`<tr><td class="txt-right">SGST</td><td class="txt-right special">₹ ${doc.totals.totalSGST.toFixed(2)}</td></tr>`);
                            }
                            if (doc.totals.totalIGST > 0) {
                                $totalRow.before(`<tr><td class="txt-right">IGST</td><td class="txt-right special">₹ ${doc.totals.totalIGST.toFixed(2)}</td></tr>`);
                            }
                        }

                        // 3. Round Off
                        if (pFooter.showRoundOff !== false && Math.abs(doc.totals.roundOff) > 0) {
                            $totalRow.before(`
                                <tr class="round_off_row">
                                    <td class="txt-right">Round Off</td>
                                    <td class="txt-right special">₹ ${doc.totals.roundOff.toFixed(2)}</td>
                                </tr>
                            `);
                        }
                    }

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

                    // 🎯 SUBTOTAL DISCOUNT
                    if (pFooter.showSubtotalDiscount !== false && (doc.totals.totalDiscount > 0 || doc.totals.discountValue > 0)) {
                        const discRow = `
                            <tr class="discount_row_footer">
                                <td class="txt-right" style="font-weight: bold;">Discount</td>
                                <td class="txt-right special">₹ ${(doc.totals.totalDiscount || 0).toFixed(2)}</td>
                            </tr>
                        `;
                        summaryTotalRow.before(discRow);
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