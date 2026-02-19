# Inward Payment Report API

## Endpoint: Generate Report
`POST /api/reports/sales/inward-payment`

Generates a read-only list of inward payments based on filters, optimized for reporting.

### Request Body
```json
{
  "filters": {
    "customerVendor": "string", // Optional: Partial match on Customer Name
    "paymentType": "string | string[]", // Optional: 'ALL' | 'CASH' | 'CHEQUE' | 'ONLINE' | 'BANK' | 'TDS' | 'BAD_DEBTS_KASAR'
    "fromDate": "YYYY-MM-DD", // Optional: Start Date
    "toDate": "YYYY-MM-DD", // Optional: End Date
    "staffId": "string", // Optional: Staff ID (if applicable)
    "invoiceSeries": "string", // Optional
    "selectedColumns": [
      // Optional: Array of columns to return. Defaults to all if empty.
      "Date", 
      "Particulars", 
      "Payment Type", 
      "Remarks", 
      "Vch Type", 
      "Vch No", 
      "Amount", 
      "Contact Person", 
      "PAN NO", 
      "GST NO", 
      "Created By"
    ]
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "paymentDate", // Default: paymentDate
    "sortOrder": "desc" // asc | desc
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
        "Date": "2023-10-25",
        "Particulars": "Acme Corp",
        "Payment Type": "ONLINE",
        "Remarks": "Invoice #123",
        "Vch Type": "Receipt",
        "Vch No": "REC-1001",
        "Amount": 5000,
        "Contact Person": "",
        "PAN NO": "ABCDE1234F",
        "GST NO": "27ABCDE1234F1Z5",
        "Created By": "Admin User"
      }
    ],
    "totalDocs": 1,
    "limit": 50,
    "totalPages": 1,
    "page": 1,
    "pagingCounter": 1,
    "hasPrevPage": false,
    "hasNextPage": false,
    "prevPage": null,
    "nextPage": null
  },
  "message": "Inward payment report generated successfully"
}
```

---

## Endpoint: Get Metadata
`GET /api/reports/sales/inward-payment/metadata`

Returns available filter options and columns for UI configuration.

### Response
```json
{
  "success": true,
  "data": {
    "paymentTypes": [
      "ALL", "CASH", "CHEQUE", "ONLINE", "BANK", "TDS", "BAD_DEBTS_KASAR"
    ],
    "columns": [
      "Date", "Particulars", "Payment Type", "Remarks", 
      "Vch Type", "Vch No", "Amount", "Contact Person", 
      "PAN NO", "GST NO", "Created By"
    ],
    "sortFields": ["paymentDate", "amount", "receiptNo"]
  },
  "message": "Metadata retrieved successfully"
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
**Note**: `reportType` must be set to `inward-payment`.

```json
{
  "reportType": "inward-payment", 

  "filters": {
    "customerVendor": "", // Optional: Partial match on Customer Name
    "staffId": "", // Optional: Staff ID (if applicable)
    "invoiceSeries": "", // Optional
    "selectedColumns": [
      // Optional: Array of columns to return. Defaults to all if empty.
      "Date", 
      "Particulars", 
      "Payment Type", 
      "Remarks", 
      "Vch Type", 
      "Vch No", 
      "Amount", 
      "Contact Person", 
      "PAN NO", 
      "GST NO"
    //   "Created By"
    ],
    "dateRange": {
      "from": "2026-02-01",
      "to": "2026-02-17"
    }
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "paymentDate", // Default: paymentDate
    "sortOrder": "desc" // asc | desc
  },

  "reportTitle": "Inward Payment Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
