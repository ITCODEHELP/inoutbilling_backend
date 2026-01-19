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

### Get Single Inward Payment
```http
GET /api/inward-payments/:id
Authorization: Bearer <token>
```
Returns full payment data with all fields including custom fields.

### Update Inward Payment
```http
PUT /api/inward-payments/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | JSON String | Optional. Single JSON string containing all fields below. If provided, individual fields are ignored. |
| `receiptNo` | String | Receipt number |
| `companyName` | String | Company/Customer name |
| `amount` | Number | Payment amount |
| `paymentDate` | Date | Payment date |
| `paymentType` | Enum | `cash`, `cheque`, `online`, `bank`, `tds`, `bad_debit`, `currency_exchange_loss` (case-insensitive, auto-converted to lowercase) |
| `totalOutstanding` | Number | Optional. Total outstanding amount |
| `address` | String | Optional. Company address |
| `gstinPan` | String | Optional. GSTIN/PAN |
| `remarks` | String | Optional. Payment remarks |
| `customFields` | JSON String | Optional. Custom field values as JSON |
| `attachment` | File | Optional. New attachment file |

**Field Normalization**: The API automatically handles:
- All numeric fields (`amount`, `totalOutstanding`) are converted from strings to numbers
- Payment type is automatically converted to lowercase
- Custom fields are validated against defined field definitions

**Response**: Returns updated payment data.

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

