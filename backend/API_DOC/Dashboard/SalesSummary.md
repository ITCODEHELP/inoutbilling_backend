# Sales Summary API

Returns high-level sales totals and counts for a specific period.

## Endpoint
`GET /api/dashboard/sales-summary`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromDate | Date | No | Start date for filtering (ISO format) |
| toDate | Date | No | End date for filtering (ISO format) |
| branchId | String | No | Filter by branch (ObjectId) |

## Response Structure
```json
{
  "success": true,
  "data": {
    "totalSales": 125000.50,
    "totalTaxable": 105932.63,
    "totalTax": 19067.87,
    "invoiceCount": 45,
    "businessLogo": "uploads/business_logos/logo-...",
    "dashboardOptions": ["Verify Email"]
  }
}
```

## Performance Notes
- Uses MongoDB aggregation on indexed `userId` and `invoiceDetails.date` fields.
- Read-optimized using indexed date ranges.
