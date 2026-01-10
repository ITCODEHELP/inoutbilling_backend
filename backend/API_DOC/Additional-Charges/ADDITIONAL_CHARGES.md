**Base URL**: `http://localhost:5000/api`

## Additional Charges

### Create Charge
```http
POST /additional-charges
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "name": "Shipping",
  "price": 100,
  "hsnSacCode": "9965",
  "tax": 18,
  "isServiceItem": true
}
```

### Get Charges
```http
GET /additional-charges
Authorization: Bearer <token>
```

