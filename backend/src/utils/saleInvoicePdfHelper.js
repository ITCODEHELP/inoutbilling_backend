const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');
const PrintOptions = require('../models/Setting-Model/PrintOptions');
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

// generateGlobalHeader function removed as it caused duplication. 
// Header data is now mapped directly to the template structure in generateSaleInvoicePDF.

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

    // Header Data Objects (Strict Separation)
    let headerLeftData = {};
    let headerRightData = {};

    try {
        // Fetch full user data to ensure we have all fields for fallbacks
        const userId = user.userId || user._id; // Handle both simplified and full user objects
        fullUser = await User.findOne({ userId: userId }).lean() || {};

        // Fetch Business Data
        businessData = await Business.findOne({ userId: userId }).lean();

        // Fetch Print Settings
        if (fullUser._id) {
            printSettings = await PrintOptions.findOne({ userId: fullUser._id }).lean();
        }

        // --- PREPARE LEFT HEADER DATA (Business Details) ---
        if (businessData) {
            headerLeftData = {
                companyName: businessData.companyName || fullUser.companyName || '',
                address: businessData.address || fullUser.address || '',
                city: businessData.city || fullUser.city || '',
                state: businessData.state || fullUser.state || '',
                pincode: businessData.pincode || fullUser.pincode || '',
                gstin: businessData.gstin || fullUser.gstin || fullUser.gstNumber || '', // Check valid gstin fields
                businessLogo: businessData.businessLogo || fullUser.businessLogo || ''
            };
        } else {
            // Fallback to User Data completely if Business Data missing
            console.warn('[PDF Generator] Business data not found, using full user data as fallback');
            headerLeftData = {
                companyName: fullUser.companyName || '',
                address: fullUser.address || '',
                city: fullUser.city || '',
                state: fullUser.state || '',
                pincode: fullUser.pincode || '',
                gstin: fullUser.gstin || fullUser.gstNumber || '',
                businessLogo: fullUser.businessLogo || ''
            };
        }

        // --- PREPARE RIGHT HEADER DATA (User Contact w/ Conditional PAN) ---
        headerRightData = {
            fullName: fullUser.fullName || businessData?.fullName || '',
            phone: fullUser.displayPhone || fullUser.phone || '', // Prioritize displayPhone
            email: fullUser.email || businessData?.email || '',
            pan: null // Default to null
        };

        // Conditional PAN Logic: Only if enabled in Print Settings
        if (printSettings && printSettings.headerPrintSettings && printSettings.headerPrintSettings.showPan) {
            // Check user PAN first, then potentially business PAN if user PAN missing? 
            // Request said "User PAN", usually in User model.
            if (fullUser.pan) {
                headerRightData.pan = fullUser.pan;
            }
        }

    } catch (error) {
        console.error('[PDF Generator] Error fetching data for header:', error);
        // Emergency Fallback
        headerLeftData = { companyName: 'Error Loading Data' };
        headerRightData = { fullName: 'Error Loading Data' };
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

    docList.forEach((doc, docIdx) => {
        copies.forEach((copyType, copyIdx) => {
            const $ = cheerio.load(baseHtml);

            // --- GLOBAL STYLE OVERRIDE: ENFORCE WHITE BACKGROUND ---
            $('head').append(`
                <style>
                    body, .page-copy-container-wrapper, .page-copy-container-wrapper-letter, 
                    .page-wrapper-table, .page-wrapper-tr, .page-wrapper-tr-letter {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        -webkit-box-shadow: none !important;
                    }
                    .page-wrapper-tr, .page-wrapper-tr-letter {
                        margin: 0 !important;
                        border: none !important;
                    }
                    /* Reduce outer padding and margins for compact layout */
                    .page-wrapper, .page-wrapper-letter {
                        padding: 10px !important;
                    }
                    .page-wrapper-table {
                        margin: 0 auto !important;
                    }
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                </style>
            `);

            // --- REMOVED EXPLICIT GLOBAL HEADER INJECTION TO FIX DUPLICATION ---
            // The template already has a header section (.branding table). We will populate THAT instead.

            // Map copy type to proper label
            const copyLabels = {
                'original': 'ORIGINAL FOR RECIPIENT',
                'duplicate': 'DUPLICATE COPY',
                'transport': 'DUPLICATE FOR TRANSPORTER',
                'office': 'TRIPLICATE FOR SUPPLIER'
            };
            const copyLabel = copyLabels[copyType] || `${copyType.toUpperCase()} COPY`;

            // Check if template requires title section (templates 5-11)
            const templatesWithTitle = ['Template-5', 'Template-6', 'Template-7', 'Template-8', 'Template-9', 'Template-10', 'Template-11'];
            const shouldShowTitle = templatesWithTitle.includes(templateName);

            // Generate combined header (title only if needed)
            if (shouldShowTitle) {
                const titleSectionHtml = generateTitleSection(docType, copyLabel);
                // Try to inject inside .page-wrapper first, fallback to .page-header, then body
                if ($('.page-wrapper').length > 0) {
                    $('.page-wrapper').prepend(titleSectionHtml);
                } else if ($('.page-header').length > 0) {
                    $('.page-header').before(titleSectionHtml);
                } else {
                    $('body').prepend(titleSectionHtml);
                }
            }

            // --- 1. SET METADATA ---
            $('.invoice-title').text(docType.toUpperCase());

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

            // --- 2. INJECT DATA INTO EXISTING TEMPLATE HEADER (Strict Separation) ---

            // LEFT SECTION: Business Details
            // Company Name
            $('.org_orgname').text(headerLeftData.companyName || "").css('text-align', 'left');

            // Address (Multi-line)
            let addressHtml = headerLeftData.address || "";
            if (headerLeftData.city || headerLeftData.state || headerLeftData.pincode) {
                addressHtml += `<br>${headerLeftData.city || ""}, ${headerLeftData.state || ""} - ${headerLeftData.pincode || ""}`;
            }
            if (headerLeftData.gstin) {
                addressHtml += `<br><strong>GSTIN:</strong> ${headerLeftData.gstin}`;
            }
            $('.org_address').html(addressHtml).css('text-align', 'left');


            // RIGHT SECTION: User Contact Details
            // We map these to the existing right-aligned table cells in the template

            // Owner Name
            $('.org_contact_name').html(`<b>Name</b> : ${headerRightData.fullName || ""}`).css('text-align', 'right');

            // Phone
            $('.org_phone').html(`<b>Phone</b> : ${headerRightData.phone || ""}`).css('text-align', 'right');

            // Email & PAN (Injecting if not present in template or reusing existing structure if flexible)
            // The default template has row for Name and Phone. We can append Email/PAN rows to the parent table body.
            const $rightTableBody = $('.branding td[style*="text-align: right"] tbody');

            // Clear existing Email/PAN rows to avoid duplication on re-runs (though cheerio load is fresh per loop)
            $rightTableBody.find('.dynamic-contact-row').remove();

            if (headerRightData.email) {
                $rightTableBody.append(`
                    <tr class="dynamic-contact-row">
                        <td class="contact_details" style="text-align: right;">
                            <b>Email</b> : ${headerRightData.email}
                        </td>
                    </tr>
                `);
            }

            if (headerRightData.pan) {
                $rightTableBody.append(`
                    <tr class="dynamic-contact-row">
                        <td class="contact_details" style="text-align: right;">
                            <b>PAN</b> : ${headerRightData.pan}
                        </td>
                    </tr>
                `);
            }

            // Handle Logo Substitution (If override or business logo exists)
            // The template doesn't explicitly have an img tag for logo in strict default, 
            // but we can inject it into the Left Section before company name if needed, 
            // OR if the user meant "use HTML structure", we should see if HTML has a logo placeholder.
            // HTML has no <img> in .org_orgname. We can prepend it if a logo exists.

            let logoSrc = '';
            let rawLogoPath = options.overrideLogoPath || headerLeftData.businessLogo;
            if (rawLogoPath) {
                if (rawLogoPath.startsWith('http')) {
                    logoSrc = rawLogoPath;
                } else {
                    try {
                        let logoPath = path.resolve(rawLogoPath);
                        if (!fs.existsSync(logoPath)) {
                            const fallbackPath = path.join(__dirname, '..', rawLogoPath);
                            if (fs.existsSync(fallbackPath)) { logoPath = fallbackPath; }
                        }
                        if (fs.existsSync(logoPath)) {
                            const bitmap = fs.readFileSync(logoPath);
                            const ext = path.extname(logoPath).split('.').pop() || 'png';
                            logoSrc = `data:image/${ext};base64,${bitmap.toString('base64')}`;
                        }
                    } catch (e) { /* ignore */ }
                }
            }

            if (logoSrc) {
                // Check if valid img alias exists or prepend to company name container
                const $logoContainer = $('.org_orgname').parent().parent().parent(); // Moving up to main left table cell
                // Actually, best to prepend to the .org_orgname's container or just before .org_orgname text
                // Let's wrap .org_orgname text in a div and prepend img

                // Ideally, we place it to the left of company name. The HTML structure is a table. 
                // We can add a new cell/column for logo if we want side-by-side, or just block image above name.
                // User wants "same structure as HTML". HTML has name top-left.
                // let's put logo above name for now if not present.

                if ($('.company-logo').length === 0) {
                    $('.org_orgname').before(`<img src="${logoSrc}" class="company-logo" alt="Logo" style="max-height: 50px; display: block; margin-bottom: 5px;">`);
                }
            }

            // Customer Info
            if (doc.customerInformation) {
                $('.company_name .special').text(doc.customerInformation.ms || "");
                $('.company_address td:last-child div').text(doc.customerInformation.address || "");
                $('.cmp_gstno').text(doc.customerInformation.gstinPan || "");
            }

            // Invoice Info
            const details = doc.invoiceDetails || doc.quotationDetails || doc.deliveryChallanDetails || doc.proformaDetails || {};
            const docNum = details.invoiceNumber || details.quotationNumber || details.challanNumber || details.proformaNumber || "";
            const docDate = details.date ? new Date(details.date).toLocaleDateString() : "";

            $('.invoice_no .special').text(docNum);
            $('.invoice_date td:last-child').text(docDate);

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

            // Prepare for multi-page rendering
            const pageHtml = $.html();
            if (fullPageHtml) {
                fullPageHtml += `<div style="page-break-before: always;"></div>${pageHtml}`;
            } else {
                fullPageHtml = pageHtml;
            }
        });
    });

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

    // Convert to PDF using Puppeteer
    return await convertHtmlToPdf(fullPageHtml, {
        format: printSize === 'Thermal-2inch' || printSize === 'Thermal-3inch' ? 'A4' : printSize, // Map thermal to A4 for now or handle specifically
        landscape: orientation === 'landscape',
        printBackground: true,
        margin: { top: '2mm', right: '2mm', bottom: '2mm', left: '2mm' }
    });
};

module.exports = { generateSaleInvoicePDF };