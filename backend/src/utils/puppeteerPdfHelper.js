const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * Converts HTML content (string or file path) to a high-fidelity PDF.
 * 
 * @param {string} input - HTML string OR absolute path to an HTML file.
 * @param {Object} options - PDF generation options.
 * @param {string} options.outputPath - Optional: Path to save the PDF file.
 * @param {string} options.format - Page format (e.g., 'A4', 'Letter'). Default: 'A4'.
 * @param {boolean} options.landscape - Page orientation. Default: false.
 * @param {Object} options.margin - Page margins.
 * @param {boolean} options.printBackground - Whether to print background graphics. Default: true.
 * @returns {Promise<Buffer>} - The generated PDF as a Buffer.
 */
const convertHtmlToPdf = async (input, options = {}) => {
    let browser;
    try {
        const {
            outputPath = null,
            format = 'A4',
            landscape = false,
            margin = { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
            printBackground = true
        } = options;

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });

        const page = await browser.newPage();

        if (input.startsWith('http') || (fs.existsSync(input) && path.isAbsolute(input))) {
            const url = input.startsWith('http') ? input : `file://${input}`;
            await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        } else {
            await page.setContent(input, { waitUntil: 'networkidle0', timeout: 30000 });
        }

        const pdfBuffer = await page.pdf({
            format,
            landscape,
            margin,
            printBackground,
            displayHeaderFooter: false,
            preferCSSPageSize: true
        });

        if (outputPath) {
            const dir = path.dirname(outputPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(outputPath, pdfBuffer);
        }

        return pdfBuffer;

    } catch (error) {
        console.error('[Puppeteer PDF] Conversion Error:', error);
        throw new Error(`Failed to convert HTML to PDF: ${error.message}`);
    } finally {
        if (browser) await browser.close();
    }
};

module.exports = { convertHtmlToPdf };
