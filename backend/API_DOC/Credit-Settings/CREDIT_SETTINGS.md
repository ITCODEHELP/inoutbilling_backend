**Base URL**: `http://localhost:5000/api`

## Credit Settings

### Get Balance
```http
GET /api/setting-credit/balance
```

### Get Credit Packs
```http
GET /api/setting-credit/packs
```

### Purchase Credits
```http
POST /api/setting-credit/purchase
Content-Type: application/json
```
**Request Body**: `{ "packId": "...", "transactionId": "...", "paymentType": "ONLINE" }`

### Get Usage Logs
```http
GET /api/setting-credit/logs
```

### Get Credit Payments
```http
GET /api/setting-credit/payments
```

