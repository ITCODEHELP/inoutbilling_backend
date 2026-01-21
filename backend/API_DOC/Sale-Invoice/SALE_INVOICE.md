**Base URL**: `http://localhost:5000/api/sale-invoice`

## Sale Invoice APIs

### Create Sale Invoice
```http
POST /create
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `data` | JSON String | Optional. Single JSON string containing all fields below. If provided, individual fields are ignored. |
| `customerInformation` | JSON Object | Customer details (title, ms, address, contactPerson, phone, gstinPan, reverseCharge, shipTo, placeOfSupply) |
| `invoiceDetails` | JSON Object | Invoice headers (invoiceType, invoicePrefix, invoiceNumber, invoicePostfix, date, deliveryMode, bankSelection, hideBankDetails) |
| `items` | JSON Array | List of products/services (productName, itemNote, hsnSac, qty, stockReference, uom, price, discountType, discountValue, igst, cgst, sgst, total) |
| `additionalCharges` | JSON Array | List of extra charges (chargeName, chargeAmount, taxRate) |
| `totals` | JSON Object | Summary values (totalInvoiceValue, totalTaxable, totalTax, totalCGST, totalSGST, totalIGST, roundOff, grandTotal, totalInWords) |
| `paymentType` | Enum | `CREDIT`, `CASH`, `CHEQUE`, `ONLINE` |
| `dueDate` | Date | Optional due date |
| `bankDetails` | String | Legacy bank info string |
| `conversions` | JSON Object | linkage info (convertedTo, convertedFrom) |
| `eWayBill` | JSON Object | E-Way Bill status and JSON (generated, eWayBillNumber, eWayBillDate, eWayBillJson) |
| `termsAndConditions` | JSON Object | New T&C structure (title, text) |
| `additionalNotes` | String | Extra notes |
| `documentRemarks` | String | Remarks |
| `printRemarksFlag` | Boolean | Whether to print remarks |
| `shareOnEmail` | Boolean | Flag to trigger email share |
| `createDeliveryChallan`| Boolean | Flag to auto-create delivery challan |
| `attachments` | File(s) | Up to 5 document attachments |
| `original` | Boolean | Optional. Include original copy in PDF (default: true) |
| `duplicate` | Boolean | Optional. Include duplicate copy in PDF |
| `transport` | Boolean | Optional. Include transport copy in PDF |
| `office` | Boolean | Optional. Include office copy in PDF |

**Nested Object Structures**

**Customer Information**
```json
{
  "title": "Mr.",
  "ms": "ABC Corp",
  "address": "123 Street",
  "contactPerson": "John Doe",
  "phone": "9876543210",
  "gstinPan": "27AAAAA0000A1Z5",
  "reverseCharge": false,
  "shipTo": "Mumbai Port",
  "placeOfSupply": "Maharashtra"
}
```

**Invoice Details**
```json
{
  "invoiceType": "Tax Invoice",
  "invoicePrefix": "INV",
  "invoiceNumber": "001",
  "invoicePostfix": "2024",
  "date": "2024-01-16",
  "deliveryMode": "Road",
  "bankSelection": "SBI Current Account",
  "hideBankDetails": false
}
```

**Product Items**
```json
[
  {
    "productName": "Laptop",
    "itemNote": "16GB RAM, 512GB SSD",
    "hsnSac": "8471",
    "qty": 1,
    "stockReference": "ST-001",
    "uom": "Unit",
    "price": 45000,
    "discountType": "Percentage",
    "discountValue": 5,
    "igst": 18,
    "cgst": 0,
    "sgst": 0,
    "total": 50143.5
  }
]
```

**Response**
```json
{
  "success": true,
  "message": "Invoice saved successfully",
  "invoiceId": "...",
  "data": { ... full object ... }
}
```

### Resolve Sale Invoice Item
`POST /resolve-item`
(Authorization required)

Resolves a single item's details (price, tax, stock, totals) based on product selection or HSN.

**Request Body**
```json
{
  "productName": "Product A",
  "hsnSac": "1234",
  "qty": 2,
  "price": 1000,
  "discountValue": 10,
  "discountType": "Percentage"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "productName": "Product A",
    "productId": "...",
    "hsnSac": "1234",
    "qty": 2,
    "uom": "PCS",
    "price": 1000,
    "discountType": "Percentage",
    "discountValue": 10,
    "igst": 18,
    "cgst": 9,
    "sgst": 9,
    "taxableValue": 1800,
    "total": 2124,
    "availableStock": 50
  }
}
```

### Create Dynamic Sale Invoice
`POST /create-dynamic`
(Authorization required)

Creates an invoice with automatic product resolution, stock validation, and totals calculation.

**Request Body**
Identical to `POST /create`, but items only require `productId`, `productName`, or `hsnSac`.

**Dynamic Features:**
1. **Auto-Populate**: Resolves item details (Price, Tax, UOM) from master.
2. **Calculations**: Server-side calculation of taxable value, tax split, and invoice totals.
3. **Stock Validation**: Enforces stock limits (including serial-based validation).
4. **Audit**: Stores product snapshots internally.

**Response**
```json
{
  "success": true,
  "message": "Dynamic invoice saved successfully",
  "invoiceId": "...",
  "pdfUrl": "/uploads/invoices/pdf/...",
  "data": { ... full invoice object with derived totals ... }
}
```

### Create and Print
```http
POST /create-print
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Identical to `/create`, returns full data in `data` field.

### Get All Invoices
```http
GET /
Authorization: Bearer <token>
```
Returns array of all invoices for the logged-in user.

### Get Single Invoice
```http
GET /:id
Authorization: Bearer <token>
```
Returns full invoice data with all extended fields.

### Update Sale Invoice
```http
PUT /:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Identical request body structure to `/create`. Updates the existing invoice and re-generates its PDF.

### Get Summary
```http
GET /summary
Authorization: Bearer <token>
```
**Query Params**: `company`, `invoiceType`, `paymentType`, `fromDate`, `toDate`

### Search Invoices
```http
GET /search
Authorization: Bearer <token>
```
**Query Parameters (Optional)**:
- `company` / `customerName`: Case-insensitive partial match on customer name.
- `product` / `productName`: Case-insensitive partial match on item names.
- `productGroup`: Case-insensitive partial match on product group.
- `invoiceNo` / `invoiceNumber`: Partial match on invoice number.
- `invoiceType`: Exact match (e.g., `Tax Invoice`).
- `paymentType`: Exact match (`CREDIT`, `CASH`, etc.).
- `fromDate` / `toDate`: Date range filtering.
- `minAmount` / `maxAmount`: Grand total range filtering.
- `staffName`: Partial match on staff full name.
- `lrNo` / `transportNo`: Partial match on L.R. number.
- `challanNo` / `deliveryChallanNo`: Partial match on delivery challan number.
- `gstin` / `gstinPan`: Partial match on customer GSTIN.
- `shipTo` / `shippingAddress`: Partial match on shipping destination.
- `invoiceSeries` / `invoicePrefix`: Partial match on invoice prefix.
- `search`: Global keyword search across customer, invoice number, items, and remarks.
- `advanceFilter`: JSON object `{ "field": "City", "operator": "contains", "value": "Mumbai" }`.
  - **Supported Operators**: `equals`, `contains`, `startsWith`, `endsWith`, `greaterThan`, `lessThan`, `between`.
- `page`, `limit`, `sort`, `order`: Pagination and sorting control.

**Response**:
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "page": 1,
  "pages": 1,
  "data": [ { ... invoice object ... } ]
}
```

### Download Invoice PDF
```http
GET /:id/download
Authorization: Bearer <token>
```
Returns the PDF binary file as an attachment for direct download.

**Multi-Selection Support**: Supports comma-separated IDs in `:id` (e.g., `id1,id2,id3`). Returns a merged PDF containing all selected invoices.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

### Share via Email
```http
POST /:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Request Body**:
{
  "email": "customer@example.com",
  "original": true,
  "duplicate": false,
  "transport": false,
  "office": false
}
```

### Share via WhatsApp
```http
POST /:id/share-whatsapp
Authorization: Bearer <token>
Content-Type: application/json
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Request Body**:
```json
{
  "phone": "9876543210",
  "original": true,
  "duplicate": false,
  "transport": false,
  "office": false
}
```
**Response**: Returns a `wa.me` deep link with a pre-filled message.

### Share via SMS
```http
POST /:id/share-sms
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**:
```json
{
  "phone": "9876543210" (Optional - defaults to customer record phone)
}
```
Uses MSG91 to send invoice details and amount to the specified mobile number.

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
POST /:id/convert/delivery-challan
POST /:id/convert/proforma
POST /:id/convert/quotation
POST /:id/convert/credit-note
POST /:id/convert/debit-note
POST /:id/convert/purchase-invoice
POST /:id/convert/packing-list
```
All conversion endpoints return the newly created document.

### Generate Public Link
```http
GET /:id/public-link 
Authorization: Bearer <token>
```
**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Response**: `{ "success": true, "publicLink": "http://.../api/sale-invoice/view-public/:id/:token" }`

### View Public PDF (Unprotected) 
```http
GET /view-public/:id/:token
```
Returns PDF binary for Sale Invoice. This URL is used for the "Copy Link" feature.

**Multi-Selection Support**: Supports comma-separated IDs in `:id`.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `transport`: Boolean
- `office`: Boolean

---

## Merged Invoice PDF (Multi-Selection)

Existing endpoints for Print, Download, Email Share, WhatsApp Share, and Public View now support multiple invoices by passing a comma-separated list of IDs in the `:id` parameter.

**Example**:
`GET /api/sale-invoice/65a7...123,65a7...456,65a7...789/download?original=true&duplicate=true`

**Behavior**:
1. All selected IDs are validated and fetched.
2. For each invoice:
   - All selected copies (Original, Duplicate, etc.) are generated sequentially.
   - Each copy starts on a new page.
3. All generated pages are merged into a single PDF document.
4. If sharing via WhatsApp, a single public link is generated that opens the merged PDF.
