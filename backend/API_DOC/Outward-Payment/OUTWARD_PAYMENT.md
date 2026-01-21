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
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Get Payments
```http
GET /api/outward-payments
Authorization: Bearer <token>
```

### Get Single Outward Payment
```http
GET /api/outward-payments/:id
Authorization: Bearer <token>
```
Returns full payment data with all fields including custom fields.

### Update Outward Payment
```http
PUT /api/outward-payments/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | JSON String | Optional. Single JSON string containing all fields below. If provided, individual fields are ignored. |
| `paymentNo` | String | Payment number |
| `companyName` | String | Company/Vendor name |
| `amount` | Number | Payment amount |
| `paymentDate` | Date | Payment date |
| `paymentType` | Enum | `cash`, `cheque`, `online`, `bank`, `tds`, `bad_debit`, `currency_exchange_loss` (case-insensitive, auto-converted to lowercase) |
| `totalOutstanding` | Number | Optional. Total outstanding amount |
| `address` | String | Optional. Company address |
| `gstinPan` | String | Optional. GSTIN/PAN |
| `remarks` | String | Optional. Payment remarks |
| `customFields` | JSON String | Optional. Custom field values as JSON |
| `attachment` | File | Optional. New attachment file |
| `original` | Boolean | Optional. Include original copy in PDF (default: true) |
| `duplicate` | Boolean | Optional. Include duplicate copy in PDF |
| `transport` | Boolean | Optional. Include transport copy in PDF |
| `office` | Boolean | Optional. Include office copy in PDF |

**Field Normalization**: The API automatically handles:
- All numeric fields (`amount`, `totalOutstanding`) are converted from strings to numbers
- Payment type is automatically converted to lowercase
- Custom fields are validated against defined field definitions

**Response**: Returns updated payment data.

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
### Download / Print Payment PDF
```http
GET /api/outward-payments/:id/download
GET /api/outward-payments/:id/print
Authorization: Bearer <token>
```
Returns PDF binary for Payment Voucher.

**Multi-Selection Support**: Supports comma-separated IDs in `:id` (e.g., `id1,id2,id3`). Returns a merged PDF containing all selected vouchers.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Share Payment via Email
```http
POST /api/outward-payments/:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.
**Body**:
```json
{
  "email": "vendor@example.com",
  "original": true,
  "duplicate": false,
  "transport": false,
  "office": false
}
```

### Share Payment via WhatsApp
```http
POST /api/outward-payments/:id/share-whatsapp
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
GET /api/outward-payments/:id/public-link
Authorization: Bearer <token>
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Response**: `{ "success": true, "publicLink": "http://.../api/outward-payments/view-public/:id/:token" }`

### View Public PDF (Unprotected)
```http
GET /api/outward-payments/view-public/:id/:token
```
Returns PDF binary for Payment Voucher. This URL is used for the "Copy Link" feature.

**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Cancel Payment
```http
PUT /api/outward-payments/:id/cancel
Authorization: Bearer <token>
```
Updates status to `CANCELLED` and adds watermark to PDF.

### Delete Payment
```http
DELETE /api/outward-payments/:id
Authorization: Bearer <token>
```
Permanently removes payment record and attachments.

### Attach Files
```http
POST /api/outward-payments/:id/attach
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `attachments` (Multiple Files)

### Duplicate Payment
```http
POST /api/outward-payments/:id/duplicate
Authorization: Bearer <token>
```
Duplicates payment with new number and IDs.

---

## Merged Outward Payment PDF (Multi-Selection)

Existing endpoints for Print, Download, Email Share, WhatsApp Share, and Public View now support multiple outward payments by passing a comma-separated list of IDs in the `:id` parameter.

**Example**:
`GET /api/outward-payments/65a7...123,65a7...456/download?original=true&duplicate=true`

**Behavior**:
1. All selected records are processed.
2. For each payment, each selected copy (e.g., Original, Duplicate) starts on a new page.
3. All pages are merged into a single PDF document.
4. For WhatsApp sharing, the generated public link will open the merged PDF.
