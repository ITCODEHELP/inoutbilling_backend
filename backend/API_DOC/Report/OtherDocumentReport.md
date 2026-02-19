# Other Document Report

## Endpoint: Generate Report
`POST /api/reports/other-documents`

### Request Body
```json
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
```

### Response
```json
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
**Note**: `reportType` must be set to `other-document`.

```json
{
  "reportType": "other-document", 

  "filters": {
    "reportType": "quotation", // Required: specific doc type
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

  "reportTitle": "Other Document Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
