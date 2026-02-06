try {
    console.log("Loading saleInvoicePdfHelper...");
    require('./src/utils/saleInvoicePdfHelper');
    console.log("saleInvoicePdfHelper loaded.");

    console.log("Loading saleInvoiceController...");
    require('./src/controllers/Sales-Invoice-Controller/saleInvoiceController');
    console.log("saleInvoiceController loaded.");

    console.log("Check: Success");
} catch (e) {
    console.error("Load Failed:", e);
}
