# Company Ledger Report

## Endpoint: Generate Ledger Report
\`POST /api/reports/company-ledger\`

### Request Body
\`\`\`json
{
  "filters": {
    "customerVendor": "Company Name",
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31",
    "gstNo": "27ABCDE1234F1Z5",
    "showItemDetail": true,
    "groupRecordByCustomer": false
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "date",
    "sortOrder": "desc"
  }
}
\`\`\`

### Response
\`\`\`json
{
  "success": true,
  "data": {
    "docs": [
      {
        "date": "2026-01-10T00:00:00.000Z",
        "type": "Sale",
        "invoiceNumber": "INV-1001",
        "entityName": "Customer A",
        "gstNo": "27...",
        "grandTotal": 5000,
        "itemName": "Product A",
        "itemQty": 10,
        "itemTotal": 500
      }
    ]
  }
}
\`\`\`
