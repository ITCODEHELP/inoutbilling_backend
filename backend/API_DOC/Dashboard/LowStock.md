# Low Stock Dashboard API

Returns products where the current quantity is less than or equal to the low stock alert threshold.

## Endpoint
`GET /api/dashboard/low-stock`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| branchId | String | No | Branch filter |
| limit | Number | No | Max items (Default: 10) |

## Response Structure
```json
{
  "success": true,
  "count": 5,
  "data": [
    {
      "name": "Product X",
      "qty": 2,
      "lowStockAlert": 5,
      "unit": "PCS"
    }
  ]
}
```

## Performance Notes
- Direct query on `Product` collection with indexed sub-fields.
- Minimal projection returning only relevant fields.
