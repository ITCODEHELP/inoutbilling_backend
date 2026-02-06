const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');

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
    'A5-Default': 'saleinvoice_A5.html',
    'A5-Designed': 'saleinvoice_A5_2.html',
    'A5-Letterpad': 'saleinvoice_A5_3.html',
    'Thermal-2inch': 'saleinvoice_A5_4.html',
    'Thermal-3inch': 'saleinvoice_A5_5.html',
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

/**
 * Generates a global document header with company logo and details from Business table
 * This header is injected before template content for consistent branding
 */
const generateGlobalHeader = (businessData, userData) => {
    const logoSrc = userData.businessLogo
        ? (userData.businessLogo.startsWith('http')
            ? userData.businessLogo
            : `file://${path.join(__dirname, '..', userData.businessLogo)}`)
        : '';

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
                <div><strong>Name:</strong> ${businessData.fullName || ''}</div>
                <div><strong>Phone:</strong> ${userData.phone || ''}</div>
                <div><strong>Email:</strong> ${businessData.email || ''}</div>
            </div>
        </div>
    `;
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

    // Fetch Business data from database
    let businessData = {};
    try {
        businessData = await Business.findOne({ userId: user.userId || user._id }).lean();
        if (!businessData) {
            console.warn('[PDF Generator] Business data not found, using user data as fallback');
            businessData = {
                companyName: user.companyName || '',
                fullName: user.fullName || user.username || '',
                email: user.email || '',
                address: user.address || '',
                city: user.city || '',
                state: user.state || '',
                pincode: user.pincode || ''
            };
        }
    } catch (error) {
        console.error('[PDF Generator] Error fetching Business data:', error);
        businessData = {
            companyName: user.companyName || '',
            fullName: user.fullName || user.username || '',
            email: user.email || '',
            address: user.address || '',
            city: user.city || '',
            state: user.state || '',
            pincode: user.pincode || ''
        };
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

            // --- INJECT GLOBAL HEADER AT TOP OF PAGE WRAPPER ---
            const globalHeaderHtml = generateGlobalHeader(businessData, user);

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

            // Generate combined header (title + global header for specific templates)
            let combinedHeader = globalHeaderHtml;
            if (shouldShowTitle) {
                const titleSectionHtml = generateTitleSection(docType, copyLabel);
                combinedHeader = titleSectionHtml + globalHeaderHtml;
            }

            // Try to inject inside .page-wrapper first, fallback to .page-header, then body
            if ($('.page-wrapper').length > 0) {
                $('.page-wrapper').prepend(combinedHeader);
            } else if ($('.page-header').length > 0) {
                $('.page-header').before(combinedHeader);
            } else {
                $('body').prepend(combinedHeader);
            }

            // Add CSS to prevent page breaks between header and content
            $('head').append(`
                <style>
                    .global-document-header {
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                    }
                    .page-wrapper {
                        page-break-inside: auto !important;
                    }
                    .page-wrapper-tr {
                        page-break-before: avoid !important;
                    }
                </style>
            `);

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

            // --- 2. INJECT DATA ---
            // Company Info
            if (docType === 'Sale Invoice') {
                // Specific header for Sale Invoice as requested (Top-Left: Company, State, Pincode | Top-Right: Owner, Email, Phone)
                $('.org_orgname').text(user.companyName || "").css('text-align', 'left');
                $('.org_address').text(`${user.state || ""} - ${user.pincode || ""}`).css('text-align', 'left');
                $('.gstin span').text(`GSTIN: ${user.gstin || ""}`).css('text-align', 'left');

                $('.org_contact_name').html(`<b>Owner</b> : ${user.fullName || ""}`).css('text-align', 'right');
                $('.org_phone').html(`<b>Phone</b> : ${user.phone || ""}`).css('text-align', 'right');

                // Add email to the top-right branding table
                const $rightTable = $('.branding td[style*="text-align: right"] tbody');
                $rightTable.append(`
                    <tr>
                        <td class="contact_details" style="text-align: right;">
                            <b>Email</b> : ${user.email || ""}
                        </td>
                    </tr>
                `);
            } else {
                // Default header for other documents
                $('.org_orgname').text(user.companyName || "");
                $('.org_address').html(`${user.address || ""}<br>${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`);
                $('.gstin span').text(`GSTIN: ${user.gstin || ""}`);
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