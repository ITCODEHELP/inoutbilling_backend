# Profit & Loss Report

## Endpoint: Generate Profit & Loss
`POST /api/reports/profit-loss`

### Request Body
```json
{
  "filters": {
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31"
  },
  "options": {}
}
```

### Response
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "name": "Sale",
        "amount": 50000,
        "type": "Income"
      },
      {
        "name": "Purchase",
        "amount": 30000,
        "type": "Expense"
      },
      {
        "name": "Rent",
        "amount": 5000,
        "type": "Expense"
      }
    ],
    "totalDocs": 3,
    "limit": 3,
    "totalPages": 1,
    "page": 1,
    "summary": {
      "totalIncome": 50000,
      "totalExpense": 35000,
      "netProfit": 15000
    }
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
