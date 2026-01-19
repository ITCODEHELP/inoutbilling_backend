const fs = require('fs');
const path = require('path');
const { generateReceiptVoucherPDF } = require('./src/utils/receiptPdfHelper');

const mockUser = {
    companyName: "ITCode",
    address: "Mota varachha surat\nabc",
    city: "surat",
    state: "Gujarat",
    pincode: "394101",
    fullName: "Hardik",
    phone: "9725306146",
    email: "hardik.itcodeinfotech@gmail.com"
};

const mockData = {
    customerInformation: {
        ms: "Retail Sale",
        address: "surat, Gujarat",
        phone: "-",
        gstinPan: "-",
        placeOfSupply: "Gujarat ( 24 )"
    },
    invoiceDetails: {
        invoiceNumber: "1",
        date: new Date("2026-01-01")
    },
    items: [
        {
            productName: "Account :\n  Retail Sale\n\nThrough :\n  CASH",
            qty: 1,
            price: 0,
            total: 0.00
        }
    ],
    totals: {
        grandTotal: 0.00,
        totalInWords: "ZERO RUPEES ONLY"
    },
    termsDetails: ""
};

async function verify() {
    console.log("Generating Sample Receipt PDF...");
    try {
        const buffer = await generateReceiptVoucherPDF(mockData, mockUser);
        const filePath = path.join(__dirname, 'sample_receipt.pdf');
        fs.writeFileSync(filePath, buffer);
        console.log(`PDF saved to: ${filePath}`);
    } catch (error) {
        console.error("Error generating PDF:", error);
    }
}

verify();
