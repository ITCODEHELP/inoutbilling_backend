# Profit & Loss Report

## Endpoint: Generate Profit & Loss Summary
`POST /api/reports/profit-loss`

### Request Body
```json
{
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "page": 1,
  "limit": 10
}
```

### Response
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "name": "Opening Stock Value",
        "type": "Expense",
        "amount": 10000
      },
      {
        "name": "Purchase",
        "type": "Expense",
        "amount": 30000
      },
      {
        "name": "Expense",
        "type": "Expense",
        "amount": 5000
      },
      {
        "name": "Sales",
        "type": "Income",
        "amount": 50000
      },
      {
        "name": "Closing Stock Value",
        "type": "Income",
        "amount": 8000
      }
    ],
    "totalDocs": 5,
    "limit": 10,
    "totalPages": 1,
    "page": 1,
    "summary": {
      "totalIncome": 58000,
      "totalExpense": 45000,
      "netProfit": 13000
    }
  },
  "message": "Profit & Loss Report generated successfully"
}
```

---

## Endpoint: Generate Profit & Loss Details (Drill-down)
`POST /api/reports/profit-loss/details`

### Request Body
```json
{
  "name": "Sales",
  "fromDate": "2026-01-01",
  "toDate": "2026-01-31",
  "page": 1,
  "limit": 10
}
```

### Response
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "date": "2026-01-15",
        "particulars": "Mr. Rajesh Kumar",
        "voucherNo": "INV-001",
        "amount": 156580
      }
    ],
    "totalDocs": 1,
    "limit": 10,
    "totalPages": 1,
    "page": 1,
    "summary": {
      "totalAmount": 156580
    }
  },
  "message": "Sales details fetched successfully"
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
**Note**: `reportType` must be set to `profit-loss`.

```json
{
  "reportType": "profit-loss", 

  "filters": {
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {},

  "reportTitle": "Profit & Loss Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```


