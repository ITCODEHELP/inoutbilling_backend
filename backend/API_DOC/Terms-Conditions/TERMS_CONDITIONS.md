**Base URL**: `http://localhost:5000/api`

## Terms & Conditions

### Save Terms
```http
POST /api/terms-conditions
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "sale_invoice": "Payment within 30 days",
  "quotation": "Valid for 15 days"
}
```

### Get Terms
```http
GET /api/terms-conditions
Authorization: Bearer <token>
```

