# Purchase Report API

## Endpoint: Generate Report
\`POST /api/reports/purchase\`

Generates purchase report based on sophisticated filters using Aggregation Pipeline.

### Request Body
\`\`\`json
{
  "filters": {
    "customerVendor": "string", // Optional: Partial match on Vendor Name (M/S)
    "productGroup": ["string"], // Optional: Array of Group Names
    "products": ["string"],     // Optional: Array of Product Names
    "invoiceNumber": "string",  // Optional
    "fromDate": "YYYY-MM-DD",
    "toDate": "YYYY-MM-DD",
    "selectedColumns": [
       "Date", "Invoice No", "Vendor Name", "GSTIN", 
       "Item Name", "Quantity", "Amount", "Total Taxable", "Grand Total"
    ]
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "invoiceDetails.date", // or 'totals.grandTotal'
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
        "Date": "2023-10-25T00:00:00.000Z",
        "Invoice No": "INV-1001",
        "Vendor Name": "ABC Suppliers",
        "GSTIN": "27AA...",
        "Item Name": "Widget A",
        "Quantity": 10,
        "Amount": 1000,
        "Grand Total": 50000 // Invoice Level total repeated for context
      }
    ],
    "totalDocs": 100,
    "limit": 50,
    "page": 1,
    "totalPages": 2
  }
}
\`\`\`
