# Company Outstanding Report

## Endpoint: Generate Outstanding Report
\`POST /api/reports/company-outstanding\`

### Request Body
\`\`\`json
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
\`\`\`

### Response
\`\`\`json
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
\`\`\`
