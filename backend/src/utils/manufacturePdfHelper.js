const fs = require('fs');
const path = require('path');
const { convertHtmlToPdf } = require('./puppeteerPdfHelper');
const Business = require('../models/Login-Model/Business');
const User = require('../models/User-Model/User');
const GeneralSettings = require('../models/Setting-Model/GeneralSetting');
const mongoose = require('mongoose');

const resolveBrandingImages = async (userId) => {
    const branding = { logo: null, background: null, footer: null, signature: null };
    if (!userId) return branding;
    try {
        const settings = await GeneralSettings.findOne({ userId: userId.toString() }).lean();
        if (!settings) return branding;
        const fields = [
            { field: 'logoPath', key: 'logo' },
            { field: 'invoiceBackgroundPath', key: 'background' },
            { field: 'invoiceFooterPath', key: 'footer' },
            { field: 'signaturePath', key: 'signature' }
        ];
        for (const { field, key } of fields) {
            const rawPath = settings[field];
            if (rawPath) {
                let fullPath = path.resolve(rawPath);
                if (!fs.existsSync(fullPath)) {
                    const tries = [path.join(process.cwd(), rawPath), path.join(process.cwd(), 'backend', rawPath)];
                    for (const p of tries) { if (fs.existsSync(p)) { fullPath = p; break; } }
                }
                if (fs.existsSync(fullPath)) {
                    const bitmap = fs.readFileSync(fullPath);
                    const ext = path.extname(fullPath).split('.').pop() || 'png';
                    branding[key] = `data:image/${ext};base64,${bitmap.toString('base64')}`;
                }
            }
        }
    } catch (e) { console.error('Branding fetch error:', e); }
    return branding;
};

/**
 * Generates a Manufacture PDF with Product details, Raw Materials, and Other Outcomes.
 */
const generateManufacturePDF = async (documents, user, options = { original: true }) => {
    const docList = Array.isArray(documents) ? documents : [documents];
    const actualId = (user._id || user.userId || user.id)?.toString();
    const branding = await resolveBrandingImages(actualId);

    let businessData = {};
    if (actualId && mongoose.Types.ObjectId.isValid(actualId)) {
        businessData = await Business.findOne({ userId: actualId }).lean() || {};
    }

    let fullPageHtml = `
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; color: #333; line-height: 1.4; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
            .company-info h1 { margin: 0; font-size: 22px; color: #2c3e50; }
            .company-info p { margin: 2px 0; font-size: 12px; color: #7f8c8d; }
            .doc-info { text-align: right; }
            .doc-info h2 { margin: 0; font-size: 20px; color: #3498db; letter-spacing: 1px; }
            .doc-info p { margin: 2px 0; font-size: 12px; font-weight: bold; }
            .section { margin-bottom: 20px; }
            .section-title { background: #ecf0f1; padding: 6px 12px; font-weight: bold; border-left: 5px solid #3498db; margin-bottom: 10px; color: #2c3e50; text-transform: uppercase; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            th { background: #3498db; color: #fff; text-align: left; padding: 10px 8px; font-size: 12px; text-transform: uppercase; }
            td { border: 1px solid #dfe6e9; padding: 8px; font-size: 12px; }
            .totals { margin-left: auto; width: 320px; background: #f9f9f9; padding: 10px; border-radius: 4px; }
            .total-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 12px; }
            .total-row.grand-total { font-weight: bold; font-size: 16px; border-bottom: none; color: #2c3e50; padding-top: 10px; margin-top: 5px; border-top: 2px solid #3498db; }
            .footer { margin-top: 60px; text-align: right; }
            .footer p { margin-bottom: 40px; font-size: 12px; }
            .signature { border-top: 1px solid #2c3e50; display: inline-block; min-width: 180px; text-align: center; padding-top: 8px; font-size: 12px; font-weight: bold; }
            .page { background: white; }
            @media print {
                .page { page-break-after: always; }
                .page:last-child { page-break-after: avoid; }
            }
        </style>
    </head>
    <body>
    `;

    for (const doc of docList) {
        const mfg = doc.toObject ? doc.toObject() : doc;
        fullPageHtml += `
        <div class="page">
            <div class="header">
                <div class="company-info">
                    ${branding.logo ? `<img src="${branding.logo}" style="max-height: 70px; max-width: 250px; margin-bottom: 10px; object-fit: contain;">` : ''}
                    <h1>${businessData.companyName || user.companyName || 'Company Name'}</h1>
                    <p>${businessData.address || user.address || ''}</p>
                    <p>${businessData.city || user.city || ''}, ${businessData.state || user.state || ''} - ${businessData.pincode || user.pincode || ''}</p>
                    ${businessData.gstin ? `<p><strong>GSTIN:</strong> ${businessData.gstin}</p>` : ''}
                </div>
                <div class="doc-info">
                    <h2>MANUFACTURE</h2>
                    <p>MFG No: ${mfg.manufactureNumber}</p>
                    <p>Date: ${new Date(mfg.manufactureDate).toLocaleDateString('en-IN')}</p>
                </div>
            </div>

            <div class="section">
                <div class="section-title">Produced Product Summary</div>
                <table style="width: 100%;">
                    <tr style="background: #fdfdfd;">
                        <td style="width: 25%; font-weight: bold; color: #7f8c8d;">FINISHED PRODUCT</td>
                        <td style="font-size: 14px; font-weight: bold; color: #2c3e50;">${mfg.product?.name || 'N/A'}</td>
                        <td style="width: 25%; font-weight: bold; color: #7f8c8d;">QUANTITY PRODUCED</td>
                        <td style="font-size: 14px; font-weight: bold; color: #2c3e50;">${mfg.quantity} ${mfg.uom || ''}</td>
                    </tr>
                </table>
            </div>

            <div class="section">
                <div class="section-title">Raw Materials Consumed</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;">SR.</th>
                            <th>ITEM NAME</th>
                            <th style="text-align: center;">QTY</th>
                            <th style="text-align: center;">UOM</th>
                            <th style="text-align: right;">RATE</th>
                            <th style="text-align: right;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mfg.rawMaterials.map((item, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td>${item.productName}</td>
                                <td style="text-align: center;">${item.qty}</td>
                                <td style="text-align: center;">${item.uom || ''}</td>
                                <td style="text-align: right;">${(item.price || 0).toFixed(2)}</td>
                                <td style="text-align: right;">${(item.total || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #fdfdfd;">
                            <td colspan="5" style="text-align: right; font-weight: bold; color: #7f8c8d;">TOTAL RAW MATERIALS</td>
                            <td style="text-align: right; font-weight: bold; color: #2c3e50; font-size: 13px;">${(mfg.rawMaterialTotal || 0).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            ${mfg.otherOutcomes && mfg.otherOutcomes.length > 0 ? `
            <div class="section">
                <div class="section-title">Other Outcomes / By-products</div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 40px;">SR.</th>
                            <th>ITEM NAME</th>
                            <th style="text-align: center;">QTY</th>
                            <th style="text-align: center;">UOM</th>
                            <th style="text-align: right;">RATE</th>
                            <th style="text-align: right;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${mfg.otherOutcomes.map((item, idx) => `
                            <tr>
                                <td style="text-align: center;">${idx + 1}</td>
                                <td>${item.productName}</td>
                                <td style="text-align: center;">${item.qty}</td>
                                <td style="text-align: center;">${item.uom || ''}</td>
                                <td style="text-align: right;">${(item.price || 0).toFixed(2)}</td>
                                <td style="text-align: right;">${(item.total || 0).toFixed(2)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #fdfdfd;">
                            <td colspan="5" style="text-align: right; font-weight: bold; color: #7f8c8d;">TOTAL OTHER OUTCOMES</td>
                            <td style="text-align: right; font-weight: bold; color: #2c3e50; font-size: 13px;">${(mfg.otherOutcomeTotal || 0).toFixed(2)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            ` : ''}

            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 10px;">
                <div style="flex: 1; padding-right: 20px;">
                    <p style="font-size: 12px; margin-bottom: 5px;"><strong>Amount in Words:</strong></p>
                    <p style="font-size: 12px; color: #2c3e50; background: #fdfdfd; padding: 8px; border: 1px solid #eee; border-radius: 4px; font-style: italic;">
                        INR ${mfg.totalInWords || 'Zero only'}
                    </p>
                    ${mfg.documentRemarks ? `
                        <p style="font-size: 12px; margin-top: 15px;"><strong>Remarks / Notes:</strong></p>
                        <p style="font-size: 11px; color: #7f8c8d;">${mfg.documentRemarks}</p>
                    ` : ''}
                </div>
                
                <div class="totals">
                    <div class="total-row">
                        <span style="color: #7f8c8d;">Raw Material Total:</span>
                        <span>${(mfg.rawMaterialTotal || 0).toFixed(2)}</span>
                    </div>
                    <div class="total-row">
                        <span style="color: #7f8c8d;">Other Outcome Total:</span>
                        <span>${(mfg.otherOutcomeTotal || 0).toFixed(2)}</span>
                    </div>
                    ${mfg.adjustment && mfg.adjustment.value ? `
                    <div class="total-row">
                        <span style="color: #7f8c8d;">Adjustment (${mfg.adjustment.sign}${mfg.adjustment.value}${mfg.adjustment.type}):</span>
                        <span>${(mfg.grandTotal - ((mfg.rawMaterialTotal || 0) + (mfg.otherOutcomeTotal || 0))).toFixed(2)}</span>
                    </div>
                    ` : ''}
                    <div class="total-row grand-total">
                        <span>Grand Total:</span>
                        <span>₹ ${(mfg.grandTotal || 0).toFixed(2)}</span>
                    </div>
                    <div style="text-align: right; font-size: 10px; color: #7f8c8d; margin-top: 5px;">
                        Unit Price: ₹ ${(mfg.unitPrice || 0).toFixed(2)} per ${mfg.uom || 'unit'}
                    </div>
                </div>
            </div>

            <div class="footer">
                <p>For <strong>${businessData.companyName || user.companyName || 'Company Name'}</strong></p>
                <div class="signature">Authorized Signatory</div>
            </div>
        </div>
        `;
    }

    fullPageHtml += `</body></html>`;

    return await convertHtmlToPdf(fullPageHtml, {
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
};

module.exports = { generateManufacturePDF };
