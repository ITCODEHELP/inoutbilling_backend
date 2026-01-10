**Base URL**: `http://localhost:5000/api`

## Digital Signature

### Upload Certificate
```http
POST /api/setting-digital-signature/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `pfxFile` (File), `password` (String)

### Toggle Signature
```http
POST /api/setting-digital-signature/toggle
Authorization: Bearer <token>
```
**Body**: `{ "enabled": true }`

### Get Status
```http
GET /api/setting-digital-signature/status
Authorization: Bearer <token>
```

