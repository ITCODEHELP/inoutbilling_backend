# Company Ledger Report

## Endpoint: Generate Ledger Report
`POST /api/reports/company-ledger`

### Request Body
```json
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
```

### Response
```json
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
**Note**: `reportType` must be set to `company-ledger`.

```json
{
  "reportType": "company-ledger", 

  "filters": {
    "customerVendor": "",
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "date", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Company Ledger Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
