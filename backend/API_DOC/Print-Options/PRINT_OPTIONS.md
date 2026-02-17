**Base URL**: `http://localhost:5000/api`

## Print Options API

Handles the configuration for document printing, PDF generation, and sharing.

### Save/Update Print Options
```http
POST /api/print-options
Authorization: Bearer <token>
Content-Type: application/json
```

**Body Structure**
All visibility settings (starting with `show` or `hide`) MUST use Boolean values (`true`/`false`).

```json
{
  "headerPrintSettings": {
    "hideDispatchFrom": false,
    "hideContactDetailInHeader": false,
    "showPanNumber": true,
    "showExporterDetails": true,
    "showStaffDetailsInHeader": false,
    "showBlankCustomFields": false,
    "headerInPdfEmail": "Default",
    "letterpadHeaderSize": "Medium"
  },
  "customerDocumentPrintSettings": {
    "showContactPerson": true,
    "showStateInCustomerDetail": true,
    "printShipToDetails": true,
    "showPaymentReceived": true,
    "showTotalOutstanding": true,
    "showReverseCharge": false,
    "hideDueDate": false,
    "hideTransport": false,
    "hideCurrencyRate": false
  },
  "productItemSettings": {
    "productImageLocation": "None",
    "hideRateColumn": false,
    "hideQuantityColumn": false,
    "hideHsnColumn": false,
    "showUomDifferentColumn": false,
    "hideSrNoAdditionalCharges": false,
    "hideTotalQuantity": false
  },
  "footerPrintSettings": {
    "showRoundOff": true,
    "showPageNumber": true,
    "printSignatureImage": true,
    "showHsnSummary": true,
    "hsnSummaryOption": "Default",
    "showSubtotalDiscount": true,
    "showPaymentReceivedBalance": true,
    "showCustomerSignatureBox": true,
    "customerSignatureLabel": "Customer Signature",
    "footerText": "",
    "showFooterImage": true
  },
  "documentPrintSettings": {
    "continuousPrinting": false,
    "printHeaderEveryPage": true,
    "showCustomerDetailsAllPages": true,
    "printBlackWhite": false,
    "invoiceBorderColor": "#000000",
    "invoiceBackgroundColor": "#ffffff",
    "fontFamily": "Roboto"
  }
}
```

### Get Print Options
```http
GET /api/print-options
Authorization: Bearer <token>
```
Returns the current print configuration for the authenticated user.
