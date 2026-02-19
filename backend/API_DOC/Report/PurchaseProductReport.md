# Purchase Product Report

## Endpoint: Generate Report
`POST /api/reports/purchase-product`

### Request Body
```json
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
```

### Response
```json
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
```

---

## Report Actions (Print, PDF, Excel, Email)

You can generate Print Views, PDFs, Excel files, or Email this report using the **Report Action Engine**.

### Endpoints
- **Print (HTML)**: `POST /api/reports/action/print`
- **PDF (Download)**: `POST /api/reports/action/pdf`
- **Excel (Download)**: `POST /api/reports/action/excel`
- **Email (Send PDF)**: `POST /api/reports/action/email`

### Request Body
Use the following payload for all the above endpoints.  
**Note**: `reportType` must be set to `purchase-product`.

```json
{
  "reportType": "purchase-product", 

  "filters": {
    "products": [],
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "totalAmount", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Purchase Product Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
