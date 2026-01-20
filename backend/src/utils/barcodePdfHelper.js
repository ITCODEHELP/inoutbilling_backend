const PDFDocument = require('pdfkit');

const generateBarcodePDF = (historyData, singleBarcode = false) => {
    return new Promise((resolve, reject) => {

        // ===== LABEL SETTINGS (Matched to Screenshot) =====
        const settings = {
            labelWidth: 50,      // mm
            labelHeight: 30,     // mm
            barcodeHeight: 18,   // mm
            fontSize: 9,
            labelsPerRow: 4,
            horizontalGap: 5,
            verticalGap: 8
        };

        const doc = new PDFDocument({
            size: 'A4',
            margin: 20
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', reject);

        // mm → points
        const mm = (v) => v * 2.83465;

        const labelWidthPt = mm(settings.labelWidth);
        const labelHeightPt = mm(settings.labelHeight);
        const barcodeHeightPt = mm(settings.barcodeHeight);
        const hGap = mm(settings.horizontalGap);
        const vGap = mm(settings.verticalGap);

        let x = doc.page.margins.left;
        let y = doc.page.margins.top;
        let count = 0;

        // If singleBarcode mode, only process first item with 1 label
        const itemsToProcess = singleBarcode ? [historyData.items[0]] : historyData.items;

        itemsToProcess.forEach(item => {
            if (!item) return; // Skip if no item exists

            const barcodeValue = String(item.generatedBarcodes[0] || '');

            // In single barcode mode, only generate 1 label regardless of noOfLabels
            const labelsToGenerate = singleBarcode ? 1 : item.noOfLabels;

            for (let i = 0; i < labelsToGenerate; i++) {

                // New row
                if (count > 0 && count % settings.labelsPerRow === 0) {
                    x = doc.page.margins.left;
                    y += labelHeightPt + vGap;
                }

                // New page
                if (y + labelHeightPt > doc.page.height - doc.page.margins.bottom) {
                    doc.addPage();
                    x = doc.page.margins.left;
                    y = doc.page.margins.top;
                }

                // ===== BARCODE DRAWING =====
                const barXStart = x + 5;
                const barY = y + 4;
                const barWidth = 1.2; // bar thickness
                const gap = 0.6;
                let barX = barXStart;

                // Simple Code-128-style visual bars
                for (let c = 0; c < barcodeValue.length; c++) {
                    const code = barcodeValue.charCodeAt(c);

                    const bars = (code % 4) + 2;
                    for (let b = 0; b < bars; b++) {
                        doc
                            .rect(barX, barY, barWidth, barcodeHeightPt)
                            .fill('#000');
                        barX += barWidth + gap;
                    }

                    barX += gap * 2;
                }

                // ===== BARCODE NUMBER (CENTERED BELOW) =====
                doc
                    .font('Courier')
                    .fontSize(settings.fontSize)
                    .fillColor('#000')
                    .text(barcodeValue, x, barY + barcodeHeightPt + 4, {
                        width: labelWidthPt,
                        align: 'center'
                    });

                // Move to next label
                x += labelWidthPt + hGap;
                count++;
            }
        });

        doc.end();
    });
};

module.exports = { generateBarcodePDF };
