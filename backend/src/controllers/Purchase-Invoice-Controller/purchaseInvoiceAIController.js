const pdf = require('pdf-parse');

// Mock storage for pending extractions (in a real app, use Redis or a temp DB)
const pendingExtractions = new Map();

/**
 * @desc    Upload Purchase Invoice PDF for AI Extraction
 * @route   POST /api/purchase-invoice/upload-ai
 * @access  Private
 */
const uploadInvoiceAI = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No PDF file uploaded" });
        }

        // Simulate AI/OCR Extraction
        const dataBuffer = req.file.buffer;
        const pdfData = await pdf(dataBuffer);
        const text = pdfData.text;

        // Mocking extraction logic based on keywords
        // In a real scenario, this would call an LLM (OpenAI/Gemini) or a specialized OCR service
        const extractedData = {
            vendorInformation: {
                ms: text.match(/Vendor:\s*(.*)/)?.[1]?.trim() || "",
                placeOfSupply: text.match(/Place of Supply:\s*(.*)/)?.[1]?.trim() || ""
            },
            invoiceDetails: {
                invoiceNumber: text.match(/Invoice No:\s*(.*)/)?.[1]?.trim() || "",
                date: text.match(/Date:\s*(.*)/)?.[1]?.trim() || new Date().toISOString(),
                invoiceType: "REGULAR"
            },
            items: [
                { productName: "Extracted Item", qty: 1, price: 0, total: 0 }
            ],
            totals: {
                grandTotal: Number(text.match(/Total:\s*([\d.]+)/)?.[1] || 0)
            },
            paymentType: "CREDIT"
        };

        // Validate mandatory fields
        const missingFields = [];
        if (!extractedData.vendorInformation.ms) missingFields.push("Vendor Name (M/S)");
        if (!extractedData.vendorInformation.placeOfSupply) missingFields.push("Place of Supply");
        if (!extractedData.invoiceDetails.invoiceNumber) missingFields.push("Invoice Number");

        // Store extracted data temporarily using userId as key or a unique ID
        const extractionId = `${req.user._id}_${Date.now()}`;
        pendingExtractions.set(extractionId, extractedData);

        if (missingFields.length > 0) {
            return res.status(200).json({
                success: true,
                extracted: false,
                message: "Some mandatory fields are missing",
                missingFields,
                extractionId,
                confirmContinue: true
            });
        }

        res.status(200).json({
            success: true,
            extracted: true,
            extractionId,
            data: extractedData
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Confirm AI Extraction results
 * @route   POST /api/purchase-invoice/upload-ai/confirm
 * @access  Private
 */
const confirmExtraction = async (req, res) => {
    try {
        const { extractionId, continue: shouldContinue } = req.body;

        if (!extractionId || !pendingExtractions.has(extractionId)) {
            return res.status(404).json({ success: false, message: "Extraction data not found or expired" });
        }

        if (shouldContinue === "Yes" || shouldContinue === true) {
            const data = pendingExtractions.get(extractionId);
            // We don't delete yet as frontend might need to refetch, 
            // but for this task we just return the data for preview.
            return res.status(200).json({
                success: true,
                message: "Extraction data retrieved for preview",
                data
            });
        } else {
            pendingExtractions.delete(extractionId);
            return res.status(200).json({
                success: true,
                message: "Extraction discarded"
            });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    uploadInvoiceAI,
    confirmExtraction
};
