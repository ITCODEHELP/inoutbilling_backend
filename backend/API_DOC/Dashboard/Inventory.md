# Inventory API

Returns total product count, total stock value, and low stock count.

## Endpoint
`GET /api/dashboard/inventory`

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
    "totalProducts": 150,
    "totalStockValue": 1250000.00,
    "lowStockItems": 12
  }
}
```

## Performance Notes
- Aggregates `Product` collection.
- Optimized for stock value calculation.
