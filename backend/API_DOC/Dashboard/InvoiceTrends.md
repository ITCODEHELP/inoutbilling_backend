# Invoice Trends API

Returns monthly sales and purchase trends (series data).

## Endpoint
`GET /api/dashboard/invoice-trends`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromDate | Date | No | Start date for filtering |
| toDate | Date | No | End date for filtering |
| branchId | String | No | Filter by branch |

## Response Structure
```json
{
  "success": true,
  "data": {
    "salesTrends": [
      { "_id": "2025-11", "amount": 45000, "count": 10 },
      { "_id": "2025-12", "amount": 60000, "count": 15 }
    ],
    "purchaseTrends": [
      { "_id": "2025-11", "amount": 20000, "count": 5 },
      { "_id": "2025-12", "amount": 35000, "count": 8 }
    ]
  }
}
```
## Performance Notes
- Uses `$dateToString` for grouping trends efficiently.
