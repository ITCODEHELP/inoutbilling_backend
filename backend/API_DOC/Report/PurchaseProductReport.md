# Purchase Product Report

## Endpoint: Generate Report
\`POST /api/reports/purchase-product\`

### Request Body
\`\`\`json
{
  "filters": {
    "customerVendor": "Vendor Name",
    "products": ["Product A", "Product B"],
    "productGroup": ["Group 1"],
    "fromDate": "2026-01-01",
    "toDate": "2026-01-09", 
    "groupingOptions": "Title" // or 'HSN'
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
        "_id": { "name": "Product A" },
        "totalQuantity": 50,
        "totalAmount": 10000,
        "avgPrice": 200,
        "count": 5
      }
    ]
  }
}
\`\`\`
