# Least Selling Products Dashboard API

Returns products with the lowest sales volume and value.

## Endpoint
`GET /api/dashboard/least-selling`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromDate | Date | No | Start date (ISO format) |
| toDate | Date | No | End date (ISO format) |
| branchId | String | No | Branch filter |
| limit | Number | No | Max items (Default: 10) |

## Response Structure
```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "name": "Product Z",
      "totalValue": 10.00,
      "totalQty": 1
    }
  ]
}
```
