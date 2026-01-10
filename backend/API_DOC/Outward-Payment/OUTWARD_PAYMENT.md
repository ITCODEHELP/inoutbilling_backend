**Base URL**: `http://localhost:5000/api`

## Outward Payment

### Create Payment
```http
POST /api/outward-payments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**
- `paymentNo` (Required)
- `companyName` (Required)
- `amount` (Required)
- `paymentDate` (Required)
- `paymentType` (Required)
- `customFields` (Optional JSON String)
- `attachment` (Optional File)

### Get Payments
```http
GET /api/outward-payments
Authorization: Bearer <token>
```

### Get Summary
```http
GET /api/outward-payments/summary
Authorization: Bearer <token>
```

### Search Payments
```http
GET /api/outward-payments/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `paymentNo`, `fromDate`, `toDate`, `paymentType`, `amount`, `staffName`, `cf_<id>`

### Save Custom Fields
```http
POST /api/outward-payments/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "name": "...", "type": "TEXT/DATE/DROPDOWN" }`

### Get Custom Fields
```http
GET /api/outward-payments/custom-fields
Authorization: Bearer <token>
```

