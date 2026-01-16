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

### Share via Email
```http
POST /:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**:
```json
{
  "email": "customer@example.com" (Optional - defaults to customer record email)
}
```

### Share via WhatsApp
```http
POST /:id/share-whatsapp
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**:
```json
{
  "phone": "9876543210" (Optional - defaults to customer record phone)
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
