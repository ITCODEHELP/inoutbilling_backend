# Purchase Outstanding Report

## Endpoint: Generate Report
\`POST /api/reports/purchase-outstanding\`

### Request Body
\`\`\`json
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
\`\`\`

### Response
\`\`\`json
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
\`\`\`
