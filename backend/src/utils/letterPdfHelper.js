const PDFDocument = require('pdfkit');
const cheerio = require('cheerio');
const sanitizeHtml = require('sanitize-html');
const path = require('path');

const formatLetterNumber = (n) => {
    if (!n) return "N/A";
    return `${n.prefix || ""}${n.number || ""}${n.postfix || ""}`.trim() || "N/A";
};

/**
 * Strict sanitization options.
 * Only allowed semantic elements.
 */
const SANITIZE_OPTIONS = {
    allowedTags: [
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li',
        'strong', 'b', 'em', 'i', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'hr', 'p', 'div', 'span', 'br', 'img'
    ],
    allowedAttributes: {
        '*': ['style', 'align', 'class'],
        'td': ['colspan', 'rowspan', 'width'],
        'th': ['colspan', 'rowspan', 'width'],
        'img': ['src', 'width', 'height', 'alt'],
    },
    allowedStyles: {
        '*': {
            'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
            'font-weight': [/^\d+$/, 'bold', 'normal'],
            'font-style': ['italic', 'normal'],
            'width': [/^\d+(?:px|em|%)$/],
            'border-top': [/.*/],
            'border-bottom': [/.*/],
            'margin-bottom': [/.*/]
        }
    }
};

/**
 * Normalizes HTML by stripping empty wrappers and ensuring strict structure.
 */
const normalizeHtml = (html, templateType) => {
    if (!html) return "";
    const cleaned = sanitizeHtml(html, SANITIZE_OPTIONS);
    const $ = cheerio.load(cleaned);

    // TARGETED FIX FOR TERMS SECTIONS (Delivery, Payment, T&C)
    const targets = [];
    $('p, div, h1, h2, h3, h4').each((i, el) => {
        const text = $(el).text().trim();
        if (/^2\.\s*Delivery Terms/i.test(text) || /^3\.\s*Payment Terms/i.test(text) || /Terms and Conditions/i.test(text)) {
            targets.push(el);
        }
    });

    targets.forEach(header => {
        let next = $(header).next();
        while (next.length &&
            !next.hasClass('divider') &&
            !next.hasClass('signature-block') &&
            !next.hasClass('signature-container') &&
            !next.hasClass('closing-text') &&
            !/Signatures|Regards|Thank you/i.test(next.text())
        ) {
            const current = next;
            next = next.next();

            if (current[0].tagName === 'ul' || current[0].tagName === 'ol') {
                const isUl = current[0].tagName === 'ul';
                let ps = '';
                current.children('li').each((j, li) => {
                    const bullet = isUl ? '• ' : `${j + 1}. `;
                    const content = $(li).text().replace(/\s+/g, ' ').trim();
                    ps += `<p class="terms-block-flow">${bullet}${content}</p>`;
                });
                current.replaceWith(ps);
            } else if (current[0].tagName === 'p') {
                current.addClass('terms-block-flow');
                current.find('span').each((j, span) => { $(span).replaceWith($(span).contents()); });
                current.removeAttr('style').find('*').removeAttr('style');
            } else if (current[0].tagName === 'div') {
                if (templateType === 'QUOTATION' || current.hasClass('terms-list')) {
                    current.find('p, div').each((j, child) => {
                        const $child = $(child);
                        if ($child.text().trim()) {
                            $child.addClass('terms-block-flow');
                            $child.find('span').each((k, s) => { $(s).replaceWith($(s).contents()); });
                            $child.removeAttr('style').find('*').removeAttr('style');
                        }
                    });
                } else {
                    current.addClass('terms-block-flow');
                    current.find('span').each((j, span) => { $(span).replaceWith($(span).contents()); });
                    current.removeAttr('style').find('*').removeAttr('style');
                }
            }
        }
    });

    // Strip empty objects BUT preserve field-values even if empty
    $('div, p').each((i, el) => {
        const $el = $(el);
        const isExcluded = ['br', 'hr', 'td', 'th'].includes(el.tagName) || $el.hasClass('field-value');
        if ($el.text().trim() === "" && $el.children().length === 0 && !isExcluded) {
            $el.remove();
        }
    });

    return $('body').html() || "";
};

const applyStyles = (doc, state) => {
    let name = 'Helvetica';
    if (state.bold && state.italic) name = 'Helvetica-BoldOblique';
    else if (state.bold) name = 'Helvetica-Bold';
    else if (state.italic) name = 'Helvetica-Oblique';
    doc.font(name).fontSize(state.fontSize).fillColor('black');
};

const checkPage = (doc, h = 15) => {
    if (doc.y + h > 750) {
        doc.addPage();
        doc.y = 40;
        return true;
    }
    return false;
};

const renderTableStrict = (doc, $, tableNode, startX, maxWidth) => {
    const rows = [];
    $(tableNode).find('tr').each((i, tr) => {
        const row = [];
        $(tr).find('th, td').each((j, td) => {
            const $td = $(td);
            row.push({
                text: $td.text().trim(),
                isHeader: td.tagName === 'th' || $td.hasClass('totals-label') || $td.attr('style')?.includes('font-weight:bold'),
                colspan: parseInt($td.attr('colspan')) || 1,
                widthStr: $td.attr('style')?.match(/width:\s*(\d+)%/)?.[1] || "0",
                align: $td.attr('align') || ($td.attr('style')?.includes('text-align:right') ? 'right' : ($td.attr('style')?.includes('text-align:center') ? 'center' : 'left')),
                bold: $td.attr('style')?.includes('font-weight:bold') || $td.hasClass('totals-label')
            });
        });
        if (row.length > 0) rows.push(row);
    });

    if (rows.length === 0) return;

    let maxCols = 0;
    rows.forEach(r => {
        let c = 0;
        r.forEach(cell => c += cell.colspan);
        if (c > maxCols) maxCols = c;
    });

    const colWidths = new Array(maxCols).fill(0);
    rows[0]?.forEach((c, i) => {
        let curIdx = 0;
        for (let prev = 0; prev < i; prev++) curIdx += rows[0][prev].colspan;
        if (c.widthStr !== "0") {
            const w = (parseFloat(c.widthStr) / 100) * maxWidth;
            for (let k = 0; k < c.colspan; k++) if (curIdx + k < maxCols) colWidths[curIdx + k] = w / c.colspan;
        }
    });

    const used = colWidths.reduce((a, b) => a + b, 0);
    const zeros = colWidths.filter(w => w === 0).length;
    if (zeros > 0) {
        const fill = (maxWidth - used) / zeros;
        colWidths.forEach((w, i) => { if (w === 0) colWidths[i] = fill; });
    }

    let y = doc.y;
    rows.forEach(row => {
        let rowH = 20;
        let cIdx = 0;
        row.forEach(cell => {
            let cw = 0;
            for (let k = 0; k < cell.colspan; k++) cw += colWidths[cIdx + k] || 0;
            const h = doc.heightOfString(cell.text, { width: cw - 6, fontSize: 8 });
            if (h + 10 > rowH) rowH = h + 10;
            cIdx += cell.colspan;
        });

        if (y + rowH > 750) { doc.addPage(); y = 40; }

        let curX = startX;
        cIdx = 0;
        row.forEach(cell => {
            let cw = 0;
            for (let k = 0; k < cell.colspan; k++) cw += colWidths[cIdx + k] || 0;
            if (cell.isHeader) {
                doc.save().fillColor('#f5f5f5').rect(curX, y, cw, rowH).fill().restore();
            }
            doc.rect(curX, y, cw, rowH).lineWidth(0.5).stroke('#000000');
            doc.font(cell.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(cell.isHeader ? 9 : 8)
                .text(cell.text, curX + 3, y + 5, { width: cw - 6, height: rowH - 10, align: cell.align });
            curX += cw; cIdx += cell.colspan;
        });
        y += rowH; doc.y = y;
    });
};

const walk = (doc, $, node, state, letter) => {
    const s = state;

    if (node.type === 'text') {
        let txt = $(node).text().replace(/<\/?[a-zA-Z!][^>]*>/gi, '').replace(/[<>]/g, '').replace(/\s+/g, ' ');
        if (!txt.trim()) return;

        checkPage(doc);
        applyStyles(doc, s);

        doc.text(txt, s.x, doc.y, {
            width: s.width,
            align: s.align,
            lineGap: s.lineGap
        });
    } else if (node.type === 'tag') {
        const tag = node.tagName.toLowerCase();
        const $el = $(node);

        if ($el.hasClass('divider')) {
            doc.moveDown(0.2).moveTo(s.x, doc.y).lineTo(s.x + s.width, doc.y).lineWidth(1).stroke('#3498db').moveDown(0.3);
            return;
        }

        // --- EXCLUSIVE SECTIONS (Ensures an element is only processed once) ---

        // 1. LOI Specialized Blocks
        if (letter.templateType === 'LETTER_OF_INTENT' && ($el.hasClass('recipient') || $el.hasClass('footer') || $el.hasClass('signature-area'))) {
            const oldBold = s.bold;
            if ($el.hasClass('recipient')) s.bold = true;
            $el.contents().each((i, child) => {
                walk(doc, $, child, s, letter);
                if (child.type === 'tag' && ['div', 'p', 'br'].includes(child.tagName)) {
                    doc.moveDown(0.15);
                }
            });
            s.bold = oldBold;
            doc.moveDown(0.6);
            return;
        }

        // 2. Boxes (Header/Number)
        if ($el.hasClass('header-box') || $el.hasClass('number-box')) {
            const oldSize = s.fontSize; const oldBold = s.bold; const oldAlign = s.align;
            const boxTop = doc.y;
            const h = ($el.hasClass('header-box')) ? 34 : 28;
            doc.rect(s.x, boxTop, s.width, h).lineWidth(1).stroke('#000000');
            doc.y += 10;
            s.fontSize = ($el.hasClass('header-box')) ? 22 : 16;
            s.bold = true; s.align = 'center';
            $el.contents().each((i, child) => walk(doc, $, child, s, letter));
            doc.y = boxTop + h;
            s.fontSize = oldSize; s.bold = oldBold; s.align = oldAlign;
            doc.moveDown(0.5);
            return;
        }

        // 3. Field Rows
        if ($el.hasClass('field-row')) {
            const label = $el.find('.field-label').text().trim();
            const value = $el.find('.field-value').text().trim();
            if (label) {
                const rowTop = doc.y;
                applyStyles(doc, s);
                doc.text(label, s.x, rowTop, { width: 140, continued: true });
                doc.text(" : ", { width: 20, continued: true });
                doc.text(value, { width: 330 });
                const underlineY = rowTop + (doc.heightOfString(value || " ", { width: 330 }) > 15 ? (doc.y - rowTop - 2) : 12);
                doc.moveTo(s.x + 160, underlineY).lineTo(s.x + 490, underlineY).lineWidth(0.5).stroke('#000000');
                doc.y = Math.max(doc.y, rowTop + 24);
                doc.moveDown(0.4);
                return;
            }
        }

        // 4. Terms Block Flow
        if ($el.hasClass('terms-block-flow')) {
            const oldSize = s.fontSize; const oldBold = s.bold; const oldAlign = s.align;
            const txt = $el.text().replace(/\s+/g, ' ').trim();
            if (txt) {
                const boldLabels = ["Validity", "Payment Terms", "Delivery Time", "Warranty", "Mode of Payment"];
                const needsBold = boldLabels.some(l => txt.includes(l + ":"));
                if (needsBold) s.bold = true;
                applyStyles(doc, s);
                doc.text(txt, s.x, doc.y, { width: s.width, align: s.align, lineGap: s.lineGap });
                s.fontSize = oldSize; s.bold = oldBold; s.align = oldAlign;
                doc.moveDown(0.3);
                return;
            }
        }

        // 5. Standard Block Processing
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li'].includes(tag) || $el.hasClass('section-header') || $el.hasClass('title')) {
            const oldSize = s.fontSize; const oldBold = s.bold; const oldAlign = s.align;

            if ($el.hasClass('title')) { s.fontSize = 16; s.bold = true; s.align = 'center'; }
            else if ($el.hasClass('section-header') || $el.hasClass('subject') || tag.startsWith('h')) { s.fontSize = 12; s.bold = true; }

            const style = $el.attr('style') || '';
            const align = $el.attr('align');
            if (style.includes('text-align:center') || align === 'center') s.align = 'center';
            else if (style.includes('text-align:right') || align === 'right' || $el.hasClass('date-area')) s.align = 'right';
            else if (style.includes('text-align:justify') || align === 'justify' || $el.hasClass('content-body')) s.align = 'justify';
            else if ($el.hasClass('subject')) s.align = 'left';

            if ($el.hasClass('date-area')) s.bold = true;
            doc.moveDown(0.1);

            if ($el.hasClass('subject') || $el.hasClass('details-header') || $el.hasClass('terms-header')) {
                doc.moveDown(0.1).moveTo(s.x, doc.y).lineTo(s.x + s.width, doc.y).lineWidth(1.2).stroke('#3498db').moveDown(0.4);
            }

            $el.contents().each((i, child) => walk(doc, $, child, s, letter));

            s.fontSize = oldSize; s.bold = oldBold; s.align = oldAlign;
            doc.moveDown(0.3);
            return;
        }

        // 6. Tables and Lists
        if (tag === 'table') { renderTableStrict(doc, $, node, s.x, s.width); doc.moveDown(0.5); return; }
        if (['ul', 'ol'].includes(tag)) {
            doc.moveDown(0.3);
            $el.children('li').each((i, liRef) => {
                const $li = $(liRef);
                const b = tag === 'ul' ? '•' : `${i + 1}.`;
                doc.font('Helvetica').fontSize(s.fontSize).text(b, s.x, doc.y, { width: 20, continued: true });
                const subState = { ...s, x: s.x + 20, width: s.width - 20 };
                $li.contents().each((j, child) => walk(doc, $, child, subState, letter));
                doc.moveDown(0.1);
            });
            doc.moveDown(0.3);
            return;
        }

        // 7. Formatting and Media
        if (['b', 'strong'].includes(tag)) {
            const b = s.bold; s.bold = true;
            $el.contents().each((i, child) => walk(doc, $, child, s, letter));
            s.bold = b;
        } else if (['i', 'em'].includes(tag)) {
            const it = s.italic; s.italic = true;
            $el.contents().each((i, child) => walk(doc, $, child, s, letter));
            s.italic = it;
        } else if (tag === 'br') {
            doc.moveDown(0.8);
        } else if (tag === 'hr') {
            doc.moveDown(0.5).moveTo(s.x, doc.y).lineTo(s.x + s.width, doc.y).lineWidth(1).stroke('#000000').moveDown(0.8);
        } else if (tag === 'img') {
            const src = $el.attr('src');
            if (src) {
                try {
                    const imgPath = src.startsWith('data:') ? src : path.resolve(process.cwd(), 'src', src.replace('../', ''));
                    doc.image(imgPath, s.x, doc.y, { width: 150 });
                    doc.moveDown(1);
                } catch (e) { }
            }
        } else {
            // Default: just walk children
            $el.contents().each((i, child) => walk(doc, $, child, s, letter));
        }
    }
};

const renderDomNodes = (doc, $, parentNode, startX, startY, maxWidth, letter) => {
    const state = {
        x: startX,
        y: startY,
        width: maxWidth,
        fontSize: 10,
        bold: false,
        italic: false,
        align: 'left',
        lineGap: 4
    };
    doc.x = startX; doc.y = startY;
    parentNode.contents().each((i, n) => walk(doc, $, n, state, letter));
};

const createPdfInternal = (letters, user, options) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true, autoFirstPage: false });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const copies = [];
        if (options.original) copies.push('original');
        if (options.duplicate) copies.push('duplicate');
        if (options.transport) copies.push('transport');
        if (options.office) copies.push('office');
        if (copies.length === 0) copies.push('original');

        const getCopyLabel = (t) => ({
            'original': "ORIGINAL COPY",
            'duplicate': "DUPLICATE COPY",
            'transport': "TRANSPORT COPY",
            'office': "OFFICE COPY"
        }[t] || "");

        letters.forEach((letter) => {
            copies.forEach((copyType) => {
                doc.addPage();
                const startX = 40;
                const startY = 40;
                const pageWidth = 515;

                // --- JOB WORK CUSTOM HEADER ---
                if (letter.templateType === 'JOB_WORK') {
                    const headerStartY = startY;

                    // Left side: Company info
                    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(user.companyName || "Company Name", startX, headerStartY, { width: 250 });
                    doc.fontSize(9).font('Helvetica')
                        .text(user.address || "", startX, doc.y)
                        .text(`${user.city || ""}, ${user.state || ""}`, startX, doc.y);

                    const leftEndY = doc.y;

                    // Right side: User contact info
                    const rightStartY = headerStartY;
                    const rightX = 380;

                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text(user.fullName || user.name || "User Name", rightX, rightStartY, { width: 175, align: 'right' });

                    doc.fontSize(9).font('Helvetica');
                    doc.text(`Phone: ${user.phone || ""}`, rightX, rightStartY + 12, { width: 175, align: 'right' });
                    doc.text(`Email: ${user.email || ""}`, rightX, rightStartY + 24, { width: 175, align: 'right' });

                    const dividerY = Math.max(leftEndY, rightStartY + 36) + 5;
                    doc.moveTo(startX, dividerY).lineTo(startX + pageWidth, dividerY).lineWidth(2).strokeColor('#3498db').stroke();
                    doc.y = dividerY + 5;
                }
                // --- NO OBJECTION LETTER CUSTOM HEADER ---
                else if (letter.templateType === 'NO_OBJECTION_LETTER') {
                    const headerStartY = startY;

                    // Left side: Company info
                    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(user.companyName || "Company Name", startX, headerStartY, { width: 250 });
                    doc.fontSize(9).font('Helvetica')
                        .text(user.address || "", startX, doc.y)
                        .text(`${user.city || ""}, ${user.state || ""}`, startX, doc.y);

                    const leftEndY = doc.y;

                    // Right side: User contact info
                    const rightStartY = headerStartY;
                    const rightX = 380;

                    doc.fontSize(9).font('Helvetica-Bold');
                    doc.text(user.fullName || user.name || "User Name", rightX, rightStartY, { width: 175, align: 'right' });

                    doc.fontSize(9).font('Helvetica');
                    doc.text(`Phone: ${user.phone || ""}`, rightX, rightStartY + 12, { width: 175, align: 'right' });
                    doc.text(`Email: ${user.email || ""}`, rightX, rightStartY + 24, { width: 175, align: 'right' });

                    const dividerY = Math.max(leftEndY, rightStartY + 36) + 5;
                    doc.moveTo(startX, dividerY).lineTo(startX + pageWidth, dividerY).lineWidth(2).strokeColor('#3498db').stroke();
                    doc.y = dividerY + 5;
                }
                // --- UNIFIED PROFESSIONAL HEADER (Suppressed for LOI, JOB_WORK, and NO_OBJECTION_LETTER) ---
                else if (letter.templateType !== 'LETTER_OF_INTENT') {
                    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text(user.companyName || "Company Name", startX, startY, { width: 250 });
                    doc.fontSize(9).font('Helvetica')
                        .text(user.address || "", startX, doc.y)
                        .text(`${user.city || ""}, ${user.state || ""} - ${user.pincode || ""}`, startX, doc.y)
                        .text(`Email: ${user.email || ""}`, startX, doc.y)
                        .text(`Phone: ${user.phone || ""}`, startX, doc.y);

                    const rightX = 350;
                    doc.fontSize(9).font('Helvetica-Bold').text("DOCUMENT INFO", rightX, startY);
                    doc.font('Helvetica')
                        .text(`Dated: ${new Date(letter.letterDate).toLocaleDateString()}`, rightX, doc.y)
                        .text(`Ref: ${formatLetterNumber(letter.letterNumber)}`, rightX, doc.y);

                    if (letter.templateType === 'QUOTATION' || letter.templateType === 'PROFORMA_INVOICE') {
                        doc.moveDown(1).fontSize(10).font('Helvetica-Bold').text(getCopyLabel(copyType), { align: 'center' });
                    }

                    doc.moveTo(startX, 115).lineTo(startX + pageWidth, 115).lineWidth(2).strokeColor('#3498db').stroke();
                    doc.moveDown(2);
                }

                let contentStartY = 130;
                if (letter.templateType === 'LETTER_OF_INTENT') {
                    contentStartY = 40;
                } else if (letter.templateType === 'NO_OBJECTION_LETTER') {
                    contentStartY = doc.y + 10;
                }
                const html = normalizeHtml(letter.letterBody, letter.templateType);
                const $ = cheerio.load(html);

                renderDomNodes(doc, $, $('body'), startX, contentStartY, pageWidth, letter);
            });
        });

        doc.end();
    });
};

const generateLetterPDF = async (letters, user, options = {}) => {
    let letterArray = [];

    if (!letters) {
        letterArray = [];
    } else if (Array.isArray(letters)) {
        letterArray = letters;
    } else if (letters.data) {
        // Handle cases where the response might be wrapped in a data property
        // (both paginated results [array] and single results [object])
        letterArray = Array.isArray(letters.data) ? letters.data : [letters.data];
    } else if (typeof letters === 'object') {
        // Handle single object case
        letterArray = [letters];
    }

    return await createPdfInternal(letterArray, user, options);
};

module.exports = { generateLetterPDF };
