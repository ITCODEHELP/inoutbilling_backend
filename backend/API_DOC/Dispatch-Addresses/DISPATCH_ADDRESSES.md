**Base URL**: `http://localhost:5000/api`

## Get Dispatch Addresses

### Add Dispatch Address
```http
POST /api/setting-security/dispatch-address
Authorization: Bearer <token>
```
**Body**
```json
{
  "gstNumber": "...",
  "companyName": "My Branch",
  "addressLine1": "..."
}
```

### Get Dispatch Addresses
```http
GET /api/setting-security/dispatch-addresses
Authorization: Bearer <token>
```

### GSTIN Auto-Fill for Dispatch
```http
GET /api/setting-security/gst-autofill-dispatch
Authorization: Bearer <token>
```

