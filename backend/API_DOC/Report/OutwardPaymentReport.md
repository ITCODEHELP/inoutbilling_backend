# Outward Payment Report

## Endpoint: Generate Report
`POST /api/reports/outward-payment`

### Request Body
```json
{
    "filters": {
        "fromDate": "2024-02-01",
        "toDate": "2024-02-20",
        "paymentType": ["ONLINE", "CASH"],
        "selectedColumns": ["Date", "Particulars", "Vch Type", "Vch No", "Amount"] 
    },
    "options": {
        "page": 1,
        "limit": 50,
        "sortBy": "Date",
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
                "Date": "2024-02-13",
                "Particulars": "Mumbai Electronics",
                "Vch Type": "Receipt",
                "Vch No": "1",
                "Amount": 17700
            },
            {
                "Date": "2024-02-13",
                "Particulars": "Stationery Mart",
                "Vch Type": "Receipt",
                "Vch No": "2",
                "Amount": 22400
            }
        ],
        "totalDocs": 5,
        "limit": 50,
        "totalPages": 1,
        "page": 1,
        "pagingCounter": 1,
        "hasPrevPage": false,
        "hasNextPage": false,
        "prevPage": null,
        "nextPage": null
    },
    "message": "Report generated successfully"
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
