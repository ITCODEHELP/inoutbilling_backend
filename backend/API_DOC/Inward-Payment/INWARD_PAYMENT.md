**Base URL**: `http://localhost:5000/api`

## Inward Payment

### Create Payment
```http
POST /api/inward-payments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**
- `receiptNo` (Required)
- `companyName` (Required)
- `amount` (Required)
- `paymentDate` (Required)
- `paymentType` (Required)
- `customFields` (Optional JSON String)
- `attachment` (Optional File)

### Get Payments
```http
GET /api/inward-payments
Authorization: Bearer <token>
```

### Get Summary
```http
GET /api/inward-payments/summary
Authorization: Bearer <token>
```

### Search Payments
```http
GET /api/inward-payments/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `receiptNo`, `fromDate`, `toDate`, `paymentType`, `amount`, `cf_<id>`

### Save Custom Fields
```http
POST /api/inward-payments/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "name": "...", "type": "TEXT/DATE/DROPDOWN" }`

### Get Custom Fields
```http
GET /api/inward-payments/custom-fields
Authorization: Bearer <token>
```

### Download / Print Receipt PDF
```http
GET /api/inward-payments/:id/download
GET /api/inward-payments/:id/print
Authorization: Bearer <token>
```
Returns PDF binary for Receipt Voucher.

### Share Receipt via Email
```http
POST /api/inward-payments/:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "email": "customer@example.com" }`

### Share Receipt via WhatsApp
```http
POST /api/inward-payments/:id/share-whatsapp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "phone": "919876543210" }`
**Response**: `{ "success": true, "waLink": "..." }`

### Generate Public Link
```http
GET /api/inward-payments/:id/public-link
Authorization: Bearer <token>
```
**Response**: `{ "success": true, "publicLink": "http://.../api/inward-payments/view-public/:id/:token" }`

### View Public PDF (Unprotected)
```http
GET /api/inward-payments/view-public/:id/:token
```
Returns PDF binary for Receipt Voucher. This URL is used for the "Copy Link" feature.

