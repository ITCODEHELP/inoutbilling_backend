const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');
const User = require('../models/User-Model/User');
const { fetchAndResolveDocumentOptions } = require('./documentOptionsHelper');

/**
 * Centralized Template Mapping
 */
const TEMPLATE_MAP = {
    'Sale Invoice': {
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
    },
    'Delivery Challan': { 'Default': 'saleinvoicedefault.html' },
    'Quotation': { 'Default': 'saleinvoicedefault.html' },
    'Purchase Invoice': { 'Default': 'saleinvoicedefault.html' },
    'Proforma Invoice': { 'Default': 'saleinvoicedefault.html' },
    'Purchase Order': { 'Default': 'saleinvoicedefault.html' },
    'Sale Order': { 'Default': 'saleinvoicedefault.html' },
    'Job Work': { 'Default': 'saleinvoicedefault.html' },
    'Packing List': { 'Default': 'saleinvoicedefault.html' },
    'Inward Payment': { 'Default': 'saleinvoicedefault.html' },
    'Outward Payment': { 'Default': 'saleinvoicedefault.html' },
    'Daily Expense': { 'Default': 'saleinvoicedefault.html' },
    'Other Income': { 'Default': 'saleinvoicedefault.html' },
    'Bank Ledger': { 'Default': 'saleinvoicedefault.html' },
};

/**
 * Resolves template filename and validates existence
 */
const resolveTemplateFile = (templateName, docType = 'Sale Invoice') => {
    // 1. Try specific module map
    let filename = '';
    if (TEMPLATE_MAP[docType] && TEMPLATE_MAP[docType][templateName]) {
        filename = TEMPLATE_MAP[docType][templateName];
    } else if (TEMPLATE_MAP['Sale Invoice'] && TEMPLATE_MAP['Sale Invoice'][templateName]) {
        // 2. Fallback to Sale Invoice map (reusing templates)
        filename = TEMPLATE_MAP['Sale Invoice'][templateName];
    } else {
        filename = 'saleinvoicedefault.html';
    }

    // Construct full path
    const fullPath = path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', filename);

    if (!fs.existsSync(fullPath)) {
        console.warn(`[PDF Generator] Template file NOT found at: ${fullPath}. Falling back to default.`);
        return path.join(__dirname, '..', 'Template', 'Sale-Invoice-Template', 'saleinvoicedefault.html');
    }
    return fullPath;
};

/**
 * Validates that required sections exist in the render payload and provides fallbacks.
 * Ensures strict separation of Header User Contact from other data sections.
 */
const validateDocumentPayload = (normalized) => {
    // 1. Ensure headerUserContact exists (Strict User Context)
    if (!normalized.headerUserContact) {
        normalized.headerUserContact = {
            name: normalized.ownerName || "",
            phone: normalized.companyPhone || "",
            email: normalized.companyEmail || ""
        };
    }

    // 2. Ensure customerSection (party) exists
    // Fallback to module-specific data if available to preserve legacy template bindings
    if (!normalized.party || !normalized.party.name) {
        const recipient = normalized.customerInformation || normalized.vendorInformation || normalized.partyDetails || {};
        normalized.party = {
            name: recipient.ms || recipient.companyName || recipient.name || "N/A",
            address: recipient.address || "",
            gstin: recipient.gstin || "",
            phone: recipient.phone || "",
            email: recipient.email || ""
        };
    }

    // 3. Ensure documentTitle exists in header
    if (!normalized.header || !normalized.header.title) {
        normalized.header = normalized.header || {};
        normalized.header.title = normalized.invoiceTitle || normalized.challanTitle || normalized.documentTitle || "DOCUMENT";
    }

    return normalized;
};

/**
 * Generates a global document header with company logo and details.
 * Right Section: Logged-in User Contact (strictly from Auth User Profile)
 */
const generateGlobalHeader = (header, userContact) => {
    const logoSrc = header.businessLogo
        ? (header.businessLogo.startsWith('http')
            ? header.businessLogo
            : `file://${path.join(__dirname, '..', header.businessLogo)}`)
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
            <!-- Left Section: Company Master Data -->
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
                    ">${header.companyName || ''}</div>
                    <div style="
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 9px;
                        color: #333333;
                        line-height: 1.2;
                    ">
                        ${header.companyAddress || ''}<br>
                        ${header.companyCity || ''}, ${header.companyState || ''} - ${header.companyPincode || ''}
                    </div>
                </div>
            </div>

            <!-- Right Section: Logged-in User Contact -->
            <div style="
                text-align: right;
                font-family: Arial, Helvetica, sans-serif;
                font-size: 9px;
                color: #333333;
                line-height: 1.4;
                min-width: 160px;
            ">
                <div><strong>Name:</strong> ${userContact.name || ''}</div>
                <div><strong>Phone:</strong> ${userContact.phone || ''}</div>
                <div><strong>Email:</strong> ${userContact.email || ''}</div>
            </div>
        </div>
    `;
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
 * Normalizes varied document data structures into a unified render payload.
 */
const normalizeDocumentData = (doc, docType, user, businessData, documentTitle, options = {}) => {
    // 1. Recipient Normalization
    const recipient = doc.customerInformation || doc.vendorInformation || doc.partyDetails || doc.vendorDetails || doc.target || {};

    // 2. Document Details Normalization
    const details = doc.invoiceDetails || doc.quotationDetails || doc.deliveryChallanDetails || doc.proformaDetails || doc.purchaseOrderDetails || doc.saleOrderDetails || doc.receiptDetails || doc.paymentDetails || doc.jobWorkDetails || doc.expenseDetails || {};

    // Attempt to find document number in various nested structures
    const docNum = details.invoiceNumber || details.quotationNumber || details.challanNumber || details.proformaNumber || details.orderNumber || details.receiptNumber || details.voucherNumber || details.jobWorkNumber || details.no || doc.no || "";

    // Attempt to find date
    const rawDate = details.date || doc.date || (doc.invoiceDetails && doc.invoiceDetails.date);
    const docDate = rawDate ? new Date(rawDate).toLocaleDateString() : "";

    // 3. Transport Details
    const transport = doc.transportDetails || {};

    // 4. Item Normalization
    const items = (doc.items || doc.rows || []).map((item, index) => ({
        srNo: index + 1,
        productName: item.productName || item.productDescription || item.description || item.particulars || item.name || "N/A",
        itemNote: item.itemNote || item.remarks || "",
        hsnSac: item.hsnSac || "",
        qty: item.qty || item.quantity || item.amount || 0,
        uom: item.uom || "",
        price: Number(item.price || item.rate || item.amount) || 0,
        total: Number(item.total || item.amount) || 0,
        debit: Number(item.debit) || 0,
        credit: Number(item.credit) || 0,
        balance: Number(item.balance) || 0,
        date: item.date ? new Date(item.date).toLocaleDateString() : ""
    }));

    // 5. Totals Normalization
    const totals = doc.totals || doc;
    const normalizedTotals = {
        totalTaxable: Number(totals.totalTaxable) || 0,
        totalCGST: Number(totals.totalCGST) || 0,
        totalSGST: Number(totals.totalSGST) || 0,
        totalIGST: Number(totals.totalIGST) || 0,
        grandTotal: Number(totals.grandTotal || totals.totalAmount || totals.totalAmountAfterTax || 0),
        totalInWords: totals.totalInWords || totals.amountInWords || "",
        totalQty: items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0)
    };

    // 5.5 Custom Fields
    const rawCF = doc.customFields || [];
    let customFields = {};
    if (Array.isArray(rawCF)) {
        rawCF.forEach(cf => { if (cf.name) customFields[cf.name] = cf.value; });
    } else if (rawCF instanceof Map) {
        customFields = Object.fromEntries(rawCF);
    } else {
        customFields = rawCF;
    }

    // Dynamic Labels resolution
    const labelTitle = options.titleLabel || documentTitle;
    const labelNo = options.numLabel || (docType === 'Purchase Invoice' ? 'Purchase No.' : (docType === 'Delivery Challan' ? 'Challan No.' : (docType.includes('Payment') || docType.includes('Receipt') ? 'Voucher No.' : 'Invoice No.')));
    const labelDate = options.dateLabel || 'Date';

    // 6. Final Payload Assembly
    // We merge into a copy of the original doc to ensure No fields are lost (Title, Customer section, etc.)
    const normalized = {
        ...doc,
        header: {
            title: labelTitle,
            companyName: businessData.companyName || user.companyName || "",
            companyAddress: businessData.address || user.address || "",
            companyCity: businessData.city || user.city || "",
            companyState: businessData.state || user.state || "",
            companyPincode: businessData.pincode || user.pincode || "",
            companyGstin: user.gstin || businessData.gstin || "",
            ownerName: user.fullName || businessData.fullName || "",
            businessLogo: user.businessLogo || businessData.businessLogo || ""
        },
        headerUserContact: {
            name: user.fullName || businessData.fullName || "",
            phone: user.displayPhone || user.phone || businessData.phone || "",
            email: user.email || businessData.email || ""
        },
        party: {
            name: recipient.ms || recipient.companyName || recipient.name || "",
            address: recipient.address || (recipient.billingAddress ? recipient.billingAddress.street : ""),
            gstin: recipient.gstinPan || recipient.gstin || recipient.gstNumber || "",
            phone: recipient.phone || "",
            email: recipient.email || "",
            shipTo: recipient.shipTo || ""
        },
        details: {
            docNo: docNum,
            date: docDate,
            docType: docType,
            labelNo,
            labelDate,
            poNo: details.poNumber || doc.poNumber || "",
            eWayBill: details.eWayBill || doc.eWayBill || "",
            challanType: details.deliveryChallanType || "",
            supplyType: details.supplyType || ""
        },
        transport: {
            vehicleNo: transport.vehicleNo || "",
            name: transport.transportName || "",
            docNo: transport.documentNo || "",
            mode: transport.dispatchThrough || transport.deliveryMode || "",
            distance: transport.distance || ""
        },
        shippingAddress: doc.shippingAddress || {},
        useSameShippingAddress: doc.useSameShippingAddress,
        items,
        totals: normalizedTotals,
        customFields,
        status: doc.status || "",
        note: doc.documentRemarks || doc.remarks || "",
        bankDetails: doc.bankDetails || {},
        terms: {
            title: doc.termsTitle || "Terms & Conditions",
            details: doc.termsDetails || ""
        }
    };

    return validateDocumentPayload(normalized);
};

/**
 * Main PDF Generation Logic using Puppeteer
 */
const generateSaleInvoicePDF = async (documents, user, options = { original: true }, docType = 'Sale Invoice', printConfig = { selectedTemplate: 'Default', printSize: 'A4', printOrientation: 'Portrait' }) => {
    const docList = Array.isArray(documents) ? documents : [documents];

    const userId = user.userId || user._id;
    let businessData = {};
    let fullUser = user;

    try {
        // Fetch full authenticated user profile for strict header contact mapping
        const profile = await User.findOne({ userId }).lean();
        if (profile) {
            fullUser = { ...user, ...profile };
        }

        businessData = await Business.findOne({ userId }).lean();
        if (!businessData) {
            console.warn('[PDF Generator] Business data not found, using user data as fallback');
            businessData = {
                companyName: fullUser.companyName || '',
                fullName: fullUser.fullName || fullUser.username || '',
                email: fullUser.email || '',
                address: fullUser.address || '',
                city: fullUser.city || '',
                state: fullUser.state || '',
                pincode: fullUser.pincode || ''
            };
        }
    } catch (error) {
        console.error('[PDFGenerator] Error fetching data:', error);
        businessData = {
            companyName: fullUser.companyName || '',
            fullName: fullUser.fullName || fullUser.username || '',
            email: fullUser.email || '',
            address: fullUser.address || '',
            city: fullUser.city || '',
            state: fullUser.state || '',
            pincode: fullUser.pincode || ''
        };
    }

    // Fetch Dynamic Document Options
    const resolvedOptions = await fetchAndResolveDocumentOptions(userId, docType);
    const documentTitle = resolvedOptions.title || docType.toUpperCase();

    // Support legacy string templateName or new config object
    const config = typeof printConfig === 'string' ?
        { selectedTemplate: printConfig, printSize: 'A4', printOrientation: 'Portrait' } :
        (printConfig || { selectedTemplate: 'Default', printSize: 'A4', printOrientation: 'Portrait' });

    const templateName = config.selectedTemplate || 'Default';
    const printSize = config.printSize || 'A4';
    const orientation = (config.printOrientation || 'Portrait').toLowerCase();

    const templatePath = resolveTemplateFile(templateName, docType);
    let baseHtml = fs.readFileSync(templatePath, 'utf8');

    const copies = [];
    if (options.original) copies.push('original');
    if (options.duplicate) copies.push('duplicate');
    if (options.transport) copies.push('transport');
    if (options.office) copies.push('office');
    if (copies.length === 0) copies.push('original');

    let fullPageHtml = "";

    docList.forEach((rawDoc, docIdx) => {
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

            // --- Normalize Data ---
            const doc = normalizeDocumentData(rawDoc, docType, fullUser, businessData, documentTitle, options);

            // --- INJECT GLOBAL HEADER AT TOP OF PAGE WRAPPER ---
            const globalHeaderHtml = generateGlobalHeader(doc.header, doc.headerUserContact);

            // Deduplication: Surgical removal of branding only
            // We remove .branding tables which usually hold seller info
            // We DO NOT remove table.header if it's the only source of title/copyname for some templates
            if ($('table.branding').length > 0) {
                $('table.branding').remove();
            } else if ($('.page-header').children('table').first().hasClass('header')) {
                // If the first table is 'header', check if it has branding info
                // If it ONLY has title/copyname, keep it. If it has branding, handle surgically.
                const hasBranding = $('.org_orgname').length > 0 || $('.org_address').length > 0;
                if (hasBranding && !templateName.includes('Template-3')) {
                    // For most templates, if it has branding, we definitely want to hide the internal branding.
                    $('.org_orgname').closest('table').hide();
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

            // Check if template requires title section (templates 5-11)
            const templatesWithTitle = ['Template-5', 'Template-6', 'Template-7', 'Template-8', 'Template-9', 'Template-10', 'Template-11'];
            const shouldShowTitle = templatesWithTitle.includes(templateName);

            // Generate combined header (title + global header for specific templates)
            let combinedHeader = globalHeaderHtml;
            if (shouldShowTitle) {
                const titleSectionHtml = generateTitleSection(doc.header.title, copyLabel);
                combinedHeader = titleSectionHtml + globalHeaderHtml;
            }

            // Inject into DOM
            if ($('.page-wrapper').length > 0) {
                $('.page-wrapper').prepend(combinedHeader);
            } else if ($('.page-header').length > 0) {
                $('.page-header').prepend(combinedHeader);
            } else {
                $('body').prepend(combinedHeader);
            }

            // Add CSS to prevent page breaks between header and content
            $('head').append(`
                <style>
                    .global-document-header {
                        width: 100% !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                    }
                    .page-wrapper {
                        page-break-inside: auto !important;
                    }
                </style>
            `);

            // --- 1. SET METADATA ---
            $('.invoice-title').text(doc.header.title);

            // Bind User Contact specifically to right-side elements if they exist in legacy templates
            $('.org_contact_name').html(`<b>Name</b> : ${doc.headerUserContact.name}`);
            $('.org_phone').html(`<b>Phone</b> : ${doc.headerUserContact.phone}`);
            $('.org_email').html(`<b>Email</b> : ${doc.headerUserContact.email}`);

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

            // Centralized Dynamic Label mapping
            $('.invoicedata_item_label').each(function () {
                const text = $(this).text().trim();
                if (text === 'Invoice No.' || text === 'Bill No.') {
                    $(this).text(doc.details.labelNo);
                } else if (text === 'Invoice Date' || text === 'Date') {
                    $(this).text(doc.details.labelDate);
                }
            });

            // --- 2. INJECT DATA ---
            // Company Info
            if (docType === 'Sale Invoice') {
                $('.org_orgname').text(doc.header.companyName).css('text-align', 'left');
                $('.org_address').text(`${doc.header.companyState} - ${doc.header.companyPincode}`).css('text-align', 'left');
                $('.gstin span').text(`GSTIN: ${doc.header.companyGstin}`).css('text-align', 'left');
                // Removed redundant org_contact_name and org_phone to prefer global header User Contact block
            } else {
                $('.org_orgname').text(doc.header.companyName);
                $('.org_address').html(`${doc.header.companyAddress}<br>${doc.header.companyCity}, ${doc.header.companyState} - ${doc.header.companyPincode}`);
                $('.gstin span').text(`GSTIN: ${doc.header.companyGstin}`);
            }

            // Recipient Info
            $('.company_name .special').text(doc.party.name);
            $('.company_address td:last-child div').text(doc.party.address);
            $('.cmp_gstno').text(doc.party.gstin);
            if (doc.party.shipTo) $('.ship_to_address').text(doc.party.shipTo);

            // Document Details
            $('.invoice_no .special').text(doc.details.docNo);
            $('.invoice_date td:last-child').text(doc.details.date);

            // Transport Details
            const $infoTable = $('.invoicedata tbody');
            if (doc.transport.vehicleNo || doc.transport.name) {
                $infoTable.append(`<tr><td class="invoicedata_item_label">Transport Detail</td><td colspan="3">${doc.transport.name || ''} ${doc.transport.vehicleNo ? `(${doc.transport.vehicleNo})` : ''}</td></tr>`);
            }

            // Items Table
            const $tbody = $('#billdetailstbody tbody');
            const $rowTemplate = $tbody.find('tr').first().clone();
            $tbody.empty();

            doc.items.forEach((item, index) => {
                const $row = $rowTemplate.clone();
                $row.find('.td-body-sr-no').text(index + 1);
                let pName = item.productName;
                if (item.itemNote) pName += `<br/><small style="font-size: 8px; color: #666;">${item.itemNote}</small>`;
                $row.find('.td-body-product-name b').html(pName);
                $row.find('.td-body-hsn-sac').text(item.hsnSac || "");
                $row.find('.td-body-qty').text(item.qty + (item.uom ? ` ${item.uom}` : ''));
                $row.find('.td-body-rate').text(item.price.toFixed(2));
                $row.find('.td-body-item-total').text(item.total.toFixed(2));
                $tbody.append($row);
            });

            // Totals
            $('.footer-total-qty').text(doc.totals.totalQty.toFixed(2));
            $('._footer_total').text(doc.totals.grandTotal.toFixed(2));
            $('.amount_in_words').text(doc.totals.totalInWords);
            if (doc.totals.totalCGST) $('.total_cgst').text(doc.totals.totalCGST.toFixed(2));
            if (doc.totals.totalSGST) $('.total_sgst').text(doc.totals.totalSGST.toFixed(2));
            if (doc.totals.totalIGST) $('.total_igst').text(doc.totals.totalIGST.toFixed(2));

            // Status & Note
            if (doc.status || doc.note) {
                $('.footer-total-row').last().after(`<tr><td colspan="2" style="font-size: 10px; color: #666; padding: 5px;"><b>Status:</b> ${doc.status} ${doc.note ? `| <b>Note:</b> ${doc.note}` : ''}</td></tr>`);
            }

            $('.footer_seal_name').text(`For ${doc.header.companyName}`);

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