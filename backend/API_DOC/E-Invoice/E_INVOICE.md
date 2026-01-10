**Base URL**: `http://localhost:5000/api`

## E-Invoice

### Toggle E-Invoice
```http
POST /api/setting-security/toggle-einvoice
Authorization: Bearer <token>
```
**Body**: `{ "enabled": true }`

### Get E-Invoice Setting
```http
GET /api/setting-security/einvoice-setting
Authorization: Bearer <token>
```

### Update E-Way Credentials
```http
POST /api/setting-security/update-eway-credentials
Authorization: Bearer <token>
```
**Body**: `{ "userId": "primary...", "password": "...", "ewayBillUserId": "...", "ewayBillPassword": "..." }`

