# Other Document Report

## Endpoint: Generate Report
\`POST /api/reports/other-documents\`

### Request Body
\`\`\`json
{
  "filters": {
    "reportType": "quotation", // [quotation, proforma, deliveryChallan, purchaseOrder, saleOrder, creditNote, debitNote, jobWork]
    "customerVendor": "Company Name",
    "documentNumber": "QT-001",
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31"
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
        "number": "QT-1001",
        "entityName": "Customer A",
        "grandTotal": 5000,
        "items": [...]
      }
    ]
  }
}
\`\`\`
