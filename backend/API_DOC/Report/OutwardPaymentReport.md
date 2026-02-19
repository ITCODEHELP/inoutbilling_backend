# Outward Payment Report

## Endpoint: Generate Report
`POST /api/reports/outward-payment`

### Request Body
```json
{
  "filters": {
    "customerVendor": "Company A",
    "paymentType": ["cash", "cheque"],
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "paymentDate",
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
        "Date": "2026-01-15",
        "Particulars": "Company A",
        "Payment Type": "CASH",
        "Vch No": "PAY-1001",
        "Amount": 5000
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
**Note**: `reportType` must be set to `outward-payment`.

```json
{
  "reportType": "outward-payment", 

  "filters": {
    "customerVendor": "",
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "paymentDate", 
    "sortOrder": "desc" 
  },

  "reportTitle": "Outward Payment Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
