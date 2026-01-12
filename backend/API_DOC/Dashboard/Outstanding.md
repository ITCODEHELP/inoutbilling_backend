# Outstanding API

Returns total receivables, payables, and aging analysis.

## Endpoint
`GET /api/dashboard/outstanding`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| branchId | String | No | Filter by branch (ObjectId) |

## Response Structure
```json
{
  "success": true,
  "data": {
    "totalReceivable": 45000.00,
    "totalPayable": 22000.00,
    "totalSales": 125000.50,
    "totalReceived": 80000.50,
    "totalPurchases": 85000.00,
    "totalPaid": 63000.00,
    "current": 30000.00,
    "overdue": 15000.00,
    "agingBuckets": [
      { "label": "1-30 Days", "value": 5000.00 },
      { "label": "31-60 Days", "value": 7000.00 },
      { "label": "60+ Days", "value": 3000.00 }
    ]
  }
}
```

## Performance Notes
- Aggregates across multiple collections (`SaleInvoice`, `PurchaseInvoice`, `InwardPayment`, `OutwardPayment`).
- Uses `Promise.all` for concurrent execution.
