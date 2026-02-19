# Other Document Product Report

## Endpoint: Generate Product Report
`POST /api/reports/other-product-reports`

### Request Body
```json
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
```

### Response
```json
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
**Note**: `reportType` must be set to `other-document-product`.

```json
{
  "reportType": "other-document-product", 

  "filters": {
    "reportType": "quotation", // Required
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "totalAmount", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Other Document Product Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
