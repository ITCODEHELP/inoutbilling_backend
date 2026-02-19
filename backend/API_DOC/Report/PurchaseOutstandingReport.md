# Purchase Outstanding Report

## Endpoint: Generate Report
`POST /api/reports/purchase-outstanding`

### Request Body
```json
{
  "filters": {
    "customerVendor": "Partial Vendor Name",
    "dueDateRange": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD" },
    "includePaid": false
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "daysOverdue",
    "sortOrder": "desc"
  }
}
```

### Response
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "vendorInformation": { "ms": "Vendor A" },
        "amount": 5000,
        "daysOverdue": 15,
        "dueDaysCategory": "0-30 Days"
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
**Note**: `reportType` must be set to `purchase-outstanding`.

```json
{
  "reportType": "purchase-outstanding", 

  "filters": {
    "customerVendor": "", 
    "dueDateRange": {
      "from": "2026-01-01",
      "to": "2026-12-31"
    }
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "daysOverdue", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Purchase Outstanding Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
