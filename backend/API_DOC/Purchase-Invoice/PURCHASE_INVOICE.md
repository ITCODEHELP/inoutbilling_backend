**Base URL**: `http://localhost:5000/api/purchase-invoice`

## Purchase Invoice APIs

### Create Purchase Invoice
```http
POST /create
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `vendorInformation` | JSON Object | Vendor details (ms, address, phone, gstinPan, placeOfSupply) |
| `invoiceDetails` | JSON Object | Invoice headers (invoiceNumber, date, billNo, etc.) |
| `items` | JSON Array | List of products (productName, hsnSac, qty, price, igst, cgst, sgst, total) |
| `totals` | JSON Object | Summary values (totalTaxable, totalTax, grandTotal, totalInWords) |
| `paymentType` | Enum | `CREDIT`, `CASH`, `CHEQUE`, `ONLINE` |
| `conversions` | JSON Object | linkage info |
| `eWayBill` | JSON Object | E-Way Bill info |
| `attachments` | File(s) | Up to 5 document attachments |
| `shareOnEmail` | Boolean | Flag to trigger email share |

### Create and Print
```http
POST /create-print
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Identical to `/create`, returns PDF binary for print.

### Get All Purchase Invoices
```http
GET /
Authorization: Bearer <token>
```
**Query Parameters (Optional)**:
- `companyName`: Filter by vendor name.
- `productName`: Filter by item name.
- `fromDate` / `toDate`: Date range.
- `minAmount` / `maxAmount`: Grand total range.

### Get Single Purchase Invoice
```http
GET /:id
Authorization: Bearer <token>
```
Returns full purchase invoice data with all extended fields.

### Update Purchase Invoice
```http
PUT /:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | JSON String | Optional. Single JSON string containing all fields below. If provided, individual fields are ignored. |
| `vendorInformation` | JSON Object | Vendor details (ms, address, phone, gstinPan, placeOfSupply) |
| `invoiceDetails` | JSON Object | Invoice headers (invoiceNumber, date, billNo, etc.) |
| `items` | JSON Array | List of products (productName, hsnSac, qty, price, igst, cgst, sgst, total) |
| `totals` | JSON Object | Summary values (totalTaxable, totalTax, grandTotal, totalInWords) |
| `paymentType` | Enum | `CREDIT`, `CASH`, `CHEQUE`, `ONLINE` (case-insensitive, auto-converted to uppercase) |
| `attachments` | File(s) | Optional new attachments |

**Field Normalization**: The API automatically handles field variations:
- Items: `name`→`productName`, `quantity`→`qty`, `rate`→`price`
- Totals: `taxableAmount`→`totalTaxable`, `cgst`→`totalCGST`, `sgst`→`totalSGST`, `igst`→`totalIGST`
- All numeric fields are automatically converted from strings to numbers
- Payment type is automatically converted to uppercase

**Response**: Returns updated invoice data with regenerated PDF URL.

### Search Invoices
```http
GET /search
Authorization: Bearer <token>
```
Supports identical query parameters as `GET /`.

### Get Summary
```http
GET /summary
Authorization: Bearer <token>
```

### Download PDF
```http
GET /:id/download
Authorization: Bearer <token>
```

### Delete Purchase Invoice
```http
DELETE /:id
Authorization: Bearer <token>
```
Permanently removes the invoice from all records.

---

### Action: Restore
```http
POST /:id/restore
Authorization: Bearer <token>
```
Restores a previously **Cancelled** invoice back to **Active** status.

### Public Envelope PDF
`GET /:id/envelope?size=Small|Medium|Large`
Returns envelope PDF.

### Resolve Purchase Item
`POST /resolve-item`
Authorization required. Resolves item details (price, tax, stock) based on product name, ID, or HSN/SAC. Replicates Sale Invoice resolution logic including HSN fallback.

**Request Body:**
```json
{
  "productName": "Product A",
  "hsnSac": "1234",
  "qty": 1
}
```

### Action: HSN Summary
`GET /:id/hsn-summary`
Authorization required. Returns a grouped summary of items by HSN code with aggregated taxable value and tax amounts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "hsnCode": "1234",
      "taxableValue": 1000,
      "cgstRate": 9,
      "sgstRate": 9,
      "igstRate": 18,
      "cgstAmount": 90,
      "sgstAmount": 90,
      "igstAmount": 180,
      "totalTax": 180
    }
  ]
}
```

### Action: Envelope
```http
GET /:id/envelope?size=Medium
Authorization: Bearer <token>
```
**Query Parameters**:
- `size`: `Small`, `Medium`, or `Large`. Default is `Medium`.

Generates an envelope PDF with the sender (Company) at the top-left and recipient (Vendor) at the bottom-right.
  
### Action: Share Email
```http
POST /:id/share-email
Authorization: Bearer <token>
```
**Body**: `{ "email": "vendor@example.com" }`
  
### Action: Share WhatsApp
```http
POST /:id/share-whatsapp
Authorization: Bearer <token>
```
**Body**: `{ "phone": "9876543210" }`

### Action: Duplicate
```http
POST /:id/duplicate
Authorization: Bearer <token>
```

### Action: Cancel
```http
POST /:id/cancel
Authorization: Bearer <token>
```

### Action: Attach File
```http
POST /:id/attach
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Files**: `attachments` key.

### Action: Generate Barcode
```http
POST /:id/generate-barcode
Authorization: Bearer <token>
```
Adds all items from the invoice to the barcode generation cart.

### E-Way Bill: Generate
```http
POST /:id/eway-bill
Authorization: Bearer <token>
```

### E-Way Bill: Download JSON
```http
GET /:id/eway-bill/json
Authorization: Bearer <token>
```

### Conversions
```http
POST /:id/convert/quotation
POST /:id/convert/sale-invoice
POST /:id/convert/credit-note
POST /:id/convert/debit-note
POST /:id/convert/purchase-order
```
All conversion endpoints return the newly created document.

### Generate Public Link (Copy Link)
```http
GET /:id/public-link
Authorization: Bearer <token>
```
Generates a secure, shareable public link for viewing the purchase invoice without authentication.

**Response**:
```json
{
  "success": true,
  "publicLink": "http://localhost:5000/api/purchase-invoice/view-public/:id/:token"
}
```

### View Public Purchase Invoice (Unprotected)
```http
GET /view-public/:id/:token
```
**No authentication required**. Validates the token and returns the purchase invoice PDF for read-only viewing.

**Features**:
- Token-based security (HMAC-SHA256)
- Read-only access (no edit/delete)
- Validates invoice status (returns error for cancelled/deleted invoices)
- Returns PDF inline for browser viewing

**Response**: PDF binary file (Content-Type: application/pdf)

**Error Responses**:
- `401`: Invalid or expired link
- `403`: Invoice cancelled or deleted
- `404`: Invoice not found
