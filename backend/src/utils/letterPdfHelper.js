const PDFDocument = require('pdfkit');

/**
 * Generates a Letter PDF by rendering the saved HTML content with dynamic header injection
 * This version properly renders HTML with formatting, tables, headers, and structure
 * @param {Object|Array} letters - Single or Multiple Letter documents
 * @param {Object} user - Logged-in User details
 * @param {Object} options - Multi-copy options
 * @returns {Promise<Buffer>}
 */
const generateLetterPDF = (letters, user, options = { original: true }) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            margin: 40,
            size: 'A4',
            bufferPages: true
        });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        const letterList = Array.isArray(letters) ? letters : [letters];

        // Determine copies to render
        const copies = [];
        if (options.original) copies.push('original');
        if (options.duplicate) copies.push('duplicate');
        if (options.transport) copies.push('transport');
        if (options.office) copies.push('office');

        // Fallback to original if nothing selected
        if (copies.length === 0) copies.push('original');

        const getCopyLabel = (type) => {
            switch (type) {
                case 'original': return "ORIGINAL COPY";
                case 'duplicate': return "DUPLICATE COPY";
                case 'transport': return "TRANSPORT COPY";
                case 'office': return "OFFICE COPY";
                default: return "";
            }
        };

        let isFirstPage = true;

        letterList.forEach((letter) => {
            copies.forEach((copyType) => {
                if (!isFirstPage) {
                    doc.addPage();
                }
                isFirstPage = false;

                const startX = 40;
                const startY = 40;
                const pageWidth = 515;

                // --- HEADER SECTION WITH COMPANY AND USER DETAILS ---
                // Left Side: Company Details
                doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold')
                    .text(user.companyName || "Company Name", startX, startY, { width: 250 });

                doc.fontSize(9).font('Helvetica')
                    .text(user.address || "", startX, doc.y + 2, { width: 250 });

                doc.text(`${user.city || ""}, ${user.state || ""}`, startX, doc.y + 2, { width: 250 });

                // Right Side: User Personal Details
                const rightX = startX + 265;
                doc.fontSize(9).font('Helvetica')
                    .text(`Name: ${user.fullName || ""}`, rightX, startY, { width: 250, align: 'left' });

                doc.text(`Phone: ${user.phone || ""}`, rightX, doc.y + 2, { width: 250, align: 'left' });

                doc.text(`Email: ${user.email || ""}`, rightX, doc.y + 2, { width: 250, align: 'left' });

                // Copy Label (if not original)
                if (copyType !== 'original') {
                    doc.fontSize(7).font('Helvetica-Bold')
                        .text(getCopyLabel(copyType), startX, startY, { width: pageWidth, align: 'right' });
                }

                // Separator line after header
                const headerEndY = doc.y + 10;
                doc.moveTo(startX, headerEndY).lineTo(startX + pageWidth, headerEndY).stroke('#cccccc');

                const contentStartY = headerEndY + 15;

                // --- LETTER CONTENT SECTION ---
                // Render HTML content with proper formatting
                renderHTMLContent(doc, letter.letterBody || "", startX, contentStartY, pageWidth);

                // --- FOOTER SECTION ---
                const footerY = 750;
                doc.fontSize(8).font('Helvetica')
                    .text(`Letter No: ${formatLetterNumber(letter.letterNumber)}`, startX, footerY, { width: pageWidth, align: 'left' });

                doc.text(`Date: ${new Date(letter.letterDate).toLocaleDateString()}`, startX, footerY, { width: pageWidth, align: 'right' });
            });
        });

        doc.end();
    });
};

/**
 * Renders HTML content with proper formatting into PDF
 * @param {PDFDocument} doc - PDFKit document instance
 * @param {String} html - HTML content to render
 * @param {Number} startX - Starting X position
 * @param {Number} startY - Starting Y position
 * @param {Number} maxWidth - Maximum width for content
 */
const renderHTMLContent = (doc, html, startX, startY, maxWidth) => {
    if (!html) return;

    // Decode HTML entities first to ensure tags are parseable
    html = decodeHTMLEntities(html);

    // Set initial position
    doc.x = startX;
    doc.y = startY;

    // Parse HTML into structured elements
    const elements = parseHTML(html);

    // Render each element
    elements.forEach(element => {
        renderElement(doc, element, startX, maxWidth);
    });
};

/**
 * Parse HTML into structured elements
 * @param {String} html - HTML content
 * @returns {Array} - Array of parsed elements
 */
const parseHTML = (html) => {
    const elements = [];

    // Remove DOCTYPE, html, head, body tags but keep their content
    html = html.replace(/<!DOCTYPE[^>]*>/gi, '')
        .replace(/<html[^>]*>/gi, '')
        .replace(/<\/html>/gi, '')
        .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
        .replace(/<body[^>]*>/gi, '')
        .replace(/<\/body>/gi, '');

    // Split by major block elements
    const blockRegex = /<(h[1-6]|p|div|table|ul|ol|li|br|hr)[^>]*>[\s\S]*?<\/\1>|<(br|hr)[^>]*\/?>/gi;

    let lastIndex = 0;
    let match;

    while ((match = blockRegex.exec(html)) !== null) {
        // Add any text before this tag
        if (match.index > lastIndex) {
            const textBefore = html.substring(lastIndex, match.index).trim();
            if (textBefore) {
                elements.push({ type: 'text', content: cleanText(textBefore) });
            }
        }

        const fullTag = match[0];
        const tagName = (match[1] || match[2]).toLowerCase();

        if (tagName.startsWith('h')) {
            const level = parseInt(tagName[1]);
            const content = extractTextContent(fullTag);
            elements.push({ type: 'heading', level, content });
        } else if (tagName === 'p' || tagName === 'div') {
            const content = extractTextContent(fullTag);
            if (content.trim()) {
                // Determine alignment
                let align = 'left';
                if (fullTag.includes('text-align: center') || fullTag.includes('align="center"')) align = 'center';
                if (fullTag.includes('text-align: right') || fullTag.includes('align="right"')) align = 'right';

                elements.push({ type: 'paragraph', content, align }); // Pass alignment
            }
        } else if (tagName === 'table') {
            const tableData = parseTable(fullTag);
            if (tableData) {
                elements.push({ type: 'table', data: tableData });
            }
        } else if (tagName === 'br') {
            elements.push({ type: 'break' });
        } else if (tagName === 'hr') {
            elements.push({ type: 'line' });
        }

        lastIndex = match.index + fullTag.length;
    }

    // Add any remaining text
    if (lastIndex < html.length) {
        const remainingText = html.substring(lastIndex).trim();
        if (remainingText) {
            elements.push({ type: 'text', content: cleanText(remainingText) });
        }
    }

    return elements;
};

/**
 * Extract text content from HTML tag
 */
const extractTextContent = (html) => {
    // Use a more robust regex that ignores > inside quotes
    return html.replace(/<(?:"[^"]*"|'[^']*'|[^'">])*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
};

/**
 * Clean text content
 */
const cleanText = (text) => {
    return text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
};

/**
 * Parse HTML table into structured data
 */
const parseTable = (tableHtml) => {
    const rows = [];
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const rowContent = rowMatch[1];
        const cells = [];
        const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
            const isHeader = cellMatch[1].toLowerCase() === 'th';
            const content = extractTextContent(cellMatch[2]);
            cells.push({ content, isHeader });
        }

        if (cells.length > 0) {
            rows.push(cells);
        }
    }

    return rows.length > 0 ? rows : null;
};

/**
 * Render a single element to PDF
 */
const renderElement = (doc, element, startX, maxWidth) => {
    const currentY = doc.y;

    // Check if we need a new page
    if (currentY > 700) {
        doc.addPage();
        doc.x = startX;
        doc.y = 40;
    }

    switch (element.type) {
        case 'heading':
            const headingSizes = { 1: 18, 2: 16, 3: 14, 4: 12, 5: 11, 6: 10 };
            doc.fontSize(headingSizes[element.level] || 12)
                .font('Helvetica-Bold')
                .text(element.content, startX, doc.y + 5, { width: maxWidth, align: 'left' })
                .font('Helvetica')
                .moveDown(0.5);
            break;

        case 'paragraph':
            doc.fontSize(10)
                .font('Helvetica')
                .text(element.content, startX, doc.y, { width: maxWidth, align: element.align || 'left', lineGap: 2 })
                .moveDown(0.3);
            break;

        case 'text':
            doc.fontSize(10)
                .font('Helvetica')
                .text(element.content, startX, doc.y, { width: maxWidth, align: 'left', lineGap: 2 });
            break;

        case 'table':
            renderTable(doc, element.data, startX, maxWidth);
            doc.moveDown(0.5);
            break;

        case 'break':
            doc.moveDown(0.5);
            break;

        case 'line':
            doc.moveTo(startX, doc.y + 5)
                .lineTo(startX + maxWidth, doc.y + 5)
                .stroke('#cccccc')
                .moveDown(0.5);
            break;
    }
};

/**
 * Render table to PDF
 */
const renderTable = (doc, rows, startX, maxWidth) => {
    if (!rows || rows.length === 0) return;

    const numCols = rows[0].length;
    const colWidth = maxWidth / numCols;
    const rowHeight = 20;
    const tableStartY = doc.y + 5;

    rows.forEach((row, rowIndex) => {
        const rowY = tableStartY + (rowIndex * rowHeight);

        // Check if we need a new page
        if (rowY > 700) {
            doc.addPage();
            doc.x = startX;
            doc.y = 40;
            return;
        }

        row.forEach((cell, colIndex) => {
            const cellX = startX + (colIndex * colWidth);

            // Draw cell border
            doc.rect(cellX, rowY, colWidth, rowHeight).stroke('#cccccc');

            // Draw cell content
            const fontSize = cell.isHeader ? 9 : 8;
            const font = cell.isHeader ? 'Helvetica-Bold' : 'Helvetica';

            doc.fontSize(fontSize)
                .font(font)
                .text(cell.content, cellX + 3, rowY + 5, {
                    width: colWidth - 6,
                    height: rowHeight - 10,
                    align: 'left',
                    ellipsis: true
                });
        });
    });

    // Move cursor below table
    doc.y = tableStartY + (rows.length * rowHeight) + 5;
};

/**
 * Helper function to format letter number
 * @param {Object} letterNumber - Letter number object
 * @returns {String} - Formatted letter number
 */
const formatLetterNumber = (letterNumber) => {
    if (!letterNumber) return "N/A";
    const { prefix = "", number = "", postfix = "" } = letterNumber;
    return `${prefix}${number}${postfix}`.trim() || "N/A";
};

/**
 * Decode HTML entities
 */
const decodeHTMLEntities = (text) => {
    return text.replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
};

module.exports = { generateLetterPDF };
