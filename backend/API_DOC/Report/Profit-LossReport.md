# Profit & Loss Report

## Endpoint: Generate Profit & Loss
\`POST /api/reports/profit-loss\`

### Request Body
\`\`\`json
{
  "filters": {
    "fromDate": "2026-01-01",
    "toDate": "2026-01-31"
  },
  "options": {}
}
\`\`\`

### Response
\`\`\`json
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
\`\`\`
