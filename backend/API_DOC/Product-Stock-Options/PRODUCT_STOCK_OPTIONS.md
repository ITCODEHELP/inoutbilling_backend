**Base URL**: `http://localhost:5000/api`

## Product & Stock Options

### Get Settings
```http
GET /api/product-stock-settings
Authorization: Bearer <token>
```

### Save Settings
```http
POST /api/product-stock-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "productOptions": { "mrp": { "status": true }, ... },
  "stockOptions": { "allowSalesWithoutStock": true },
  "batchSettings": { "batchNo": { "status": true } }
}
```

