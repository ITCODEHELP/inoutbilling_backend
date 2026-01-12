# Payment Summary Dashboard API

Returns total Inward and Outward payment amounts for the dashboard.

## Endpoint
`GET /api/dashboard/payment-summary`

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
    "totalInwardPayment": 450000.00,
    "totalOutwardPayment": 125000.00
  }
}
```

## Performance Notes
- Aggregates `InwardPayment` and `OutwardPayment` collections concurrently using `Promise.all`.
- Uses indexed `userId` and `paymentDate` fields for high-performance matching.
