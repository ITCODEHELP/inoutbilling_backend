# Invoice Amount Summary API

Returns total monetary values for various document types.

## Endpoint
`GET /api/dashboard/invoice-summary/amounts`

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
    "totalSales": 1500000.50,
    "totalPurchases": 850000.00,
    "totalExpenses": 45000.00,
    "totalIncome": 12500.00
  }
}
```

## Performance Notes
- Executes aggregation pipelines concurrently.
- No document-level data is returned, keeping the payload minimal.
