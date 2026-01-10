# Other Document Product Report

## Endpoint: Generate Product Report
\`POST /api/reports/other-product-reports\`

### Request Body
\`\`\`json
{
  "filters": {
    "reportType": "quotation", // [quotation, proforma, deliveryChallan, purchaseOrder, saleOrder, creditNote, debitNote, jobWork]
    "customerVendor": "Company Name",
    "products": ["Product A"],
    "productGroup": ["Group 1"],
    "invoiceNumber": "QT-001",
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31",
    "groupProductBy": "Product Name" // [Product Name, HSN, Product Group]
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "totalAmount",
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
        "_id": "Product A",
        "totalQuantity": 10,
        "totalAmount": 5000,
        "avgPrice": 500,
        "count": 2
      }
    ]
  }
}
\`\`\`
