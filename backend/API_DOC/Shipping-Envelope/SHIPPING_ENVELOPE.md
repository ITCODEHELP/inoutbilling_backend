**Base URL**: `http://localhost:5000/api`

## Shipping & Envelope

### Save Settings
```http
POST /api/shipping-envelope-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "shipping_options": { ... }, "title": "DELIVERY INSTRUCTIONS" }`

### Get Settings
```http
GET /api/shipping-envelope-settings
Authorization: Bearer <token>
```

