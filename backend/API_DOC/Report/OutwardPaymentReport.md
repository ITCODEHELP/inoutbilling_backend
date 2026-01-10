# Outward Payment Report

## Endpoint: Generate Report
\`POST /api/reports/outward-payment\`

### Request Body
\`\`\`json
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
\`\`\`

### Response
\`\`\`json
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
\`\`\`
