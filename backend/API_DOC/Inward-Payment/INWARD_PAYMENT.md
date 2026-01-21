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

### Get Single Payment
```http
GET /api/inward-payments/:id
Authorization: Bearer <token>
```

### Update Payment
```http
PUT /api/inward-payments/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**
- `receiptNo` (Optional)
- `companyName` (Optional)
- `amount` (Optional)
- `paymentDate` (Optional)
- `paymentType` (Optional)
- `customFields` (Optional JSON String)
- `attachment` (Optional File)

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

**Multi-Selection Support**: Supports comma-separated IDs in `:id` (e.g., `id1,id2,id3`). Returns a merged PDF containing all selected receipts.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Share Receipt via Email
```http
POST /api/inward-payments/:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.
**Body**:
```json
{
  "email": "customer@example.com",
  "original": true,
  "duplicate": false,
  "transport": false,
  "office": false
}
```

### Share Receipt via WhatsApp
```http
POST /api/inward-payments/:id/share-whatsapp
Authorization: Bearer <token>
Content-Type: application/json
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.
**Body**:
```json
{
  "phone": "919876543210",
  "original": true,
  "duplicate": false,
  "transport": false,
  "office": false
}
```
**Response**: `{ "success": true, "waLink": "..." }`

### Generate Public Link
```http
GET /api/inward-payments/:id/public-link
Authorization: Bearer <token>
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Response**: `{ "success": true, "publicLink": "http://.../api/inward-payments/view-public/:id/:token" }`

### View Public PDF (Unprotected)
```http
GET /api/inward-payments/view-public/:id/:token
```
Returns PDF binary for Receipt Voucher. This URL is used for the "Copy Link" feature.

**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Cancel Receipt
```http
PUT /api/inward-payments/:id/cancel
Authorization: Bearer <token>
```
Updates status to `CANCELLED` and adds watermark to PDF.

### Delete Receipt
```http
DELETE /api/inward-payments/:id
Authorization: Bearer <token>
```
Permanently removes receipt and attachments.

### Attach Files
```http
POST /api/inward-payments/:id/attach
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `attachments` (Multiple Files)

### Duplicate Receipt
```http
POST /api/inward-payments/:id/duplicate
Authorization: Bearer <token>
```
Duplicates receipt with new number and IDs.

---

## Merged Inward Payment PDF (Multi-Selection)

Existing endpoints for Print, Download, Email Share, WhatsApp Share, and Public View now support multiple inward payments by passing a comma-separated list of IDs in the `:id` parameter.

**Example**:
`GET /api/inward-payments/65a7...123,65a7...456/download?original=true&duplicate=true`

**Behavior**:
1. All selected records are processed.
2. For each payment, each selected copy (e.g., Original, Duplicate) starts on a new page.
3. All pages are merged into a single PDF document.
4. For WhatsApp sharing, the generated public link will open the merged PDF.
