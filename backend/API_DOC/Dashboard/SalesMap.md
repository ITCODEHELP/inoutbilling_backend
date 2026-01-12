# Sales Map API

Returns sales distribution by region (Place of Supply).

## Endpoint
`GET /api/dashboard/sales-map`

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
  "data": [
    { "state": "Maharashtra", "totalSales": 50000.00, "invoiceCount": 15 },
    { "state": "Gujarat", "totalSales": 35000.00, "invoiceCount": 10 }
  ]
}
```
