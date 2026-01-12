# Purchase Summary API

Returns high-level purchase totals and counts for a specific period.

## Endpoint
`GET /api/dashboard/purchase-summary`

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
    "totalPurchases": 85000.00,
    "totalTaxable": 72033.90,
    "totalTax": 12966.10,
    "purchaseCount": 12
  }
}
```

## Performance Notes
- Uses MongoDB aggregation on indexed `userId` and `invoiceDetails.date` fields.
