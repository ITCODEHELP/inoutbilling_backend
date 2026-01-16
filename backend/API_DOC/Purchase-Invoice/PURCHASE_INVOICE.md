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

### Generate Public Link
```http
GET /:id/public-link
Authorization: Bearer <token>
```
**Response**: `{ "success": true, "publicLink": "http://.../api/purchase-invoice/view-public/:id/:token" }`

### View Public PDF (Unprotected)
```http
GET /view-public/:id/:token
```
Returns PDF binary for Purchase Invoice. This URL is used for the "Copy Link" feature.
