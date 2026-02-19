# Company Outstanding Report

## Endpoint: Generate Outstanding Report
`POST /api/reports/company-outstanding`

### Request Body
```json
{
  "filters": {
    "customerVendor": "Company Name",
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31",
    "hideZeroOutstanding": true
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "closingBalance",
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
        "name": "Company A",
        "openingBalance": 1000,
        "debit": 5000,
        "credit": 2000,
        "closingBalance": 4000
      }
    ],
    "totalDocs": 1,
    "limit": 50,
    "totalPages": 1,
    "page": 1
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
**Note**: `reportType` must be set to `company-outstanding`.

```json
{
  "reportType": "company-outstanding", 

  "filters": {
    "customerVendor": "",
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "closingBalance", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Company Outstanding Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
