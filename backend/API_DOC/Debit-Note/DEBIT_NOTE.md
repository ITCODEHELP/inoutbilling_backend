**Base URL**: `http://localhost:5000/api`

## Debit Note

### Create Debit Note
```http
POST /api/debit-note
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "XYZ Corporation",
    "address": "456 Market St",
    "gstinPan": "27XYZAB1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "debitNoteDetails": {
    "dnNumber": "DN-0001",
    "dnDate": "2024-01-20",
    "invoiceNumber": "INV-2024-005",
    "invoiceDate": "2024-01-15",
    "docType": "Regular",
    "dnType": "Quantity Shortage",
    "deliveryMode": "Courier"
  },
  "items": [
    {
      "productName": "Product B",
      "qty": 5,
      "price": 200,
      "discount": 10,
      "igst": 18
    }
  ],
  "additionalCharges": [
    {
      "name": "Freight",
      "amount": 100,
      "tax": 18
    }
  ],
  "useSameShippingAddress": true
}
```
> **Note**: All totals (totalDebitValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using shared calculation utilities. Tax determination (IGST vs CGST+SGST) is based on place of supply comparison.

### Get Debit Notes (Paginated)
```http
GET /api/debit-note?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```

### Get Debit Note by ID
```http
GET /api/debit-note/:id
Authorization: Bearer <token>
```

### Update Debit Note
```http
PUT /api/debit-note/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Debit Note
```http
DELETE /api/debit-note/:id
Authorization: Bearer <token>
```

### Search Debit Notes
```http
GET /api/debit-note/search?company=XYZ&product=Widget&fromDate=2024-01-01&toDate=2024-12-31&dnType=goods%20return
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, D.N. number, remarks, product names, item notes
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on D.N. Date
- `staffName`: Filter by staff name (resolves to ID)
- `dnNumber`, `debitNoteNumber`: Search in prefix/number/postfix
- `minTotal`, `maxTotal`: Filter by grand total range
- `lrNo`: Search in customFields.lr_no
- `eWayBill`: E-Way Bill filter with modes:
  - `without` or `without e-way bill`: Records without E-Way Bill
  - `with` or `with e-way bill`: Records with active E-Way Bill
  - `cancelled` or `cancelled e-way bill`: Records with cancelled E-Way Bill
  - Direct number: Search by E-Way Bill number
- `itemNote`: Filter by item notes
- `remarks`: Filter by document remarks
- `gstin`: Filter by GSTIN/PAN
- `dnType`, `debitNoteType`: Filter by Debit Note Type (enum: goods return, discount after save, correction in invoice)
- `docType`: Filter by Document Type (enum: regular, bill of supply, sez debit note (with IGST), sez debit note (without IGST), export debit(with IGST), export debit(without IGST))
- `shippingAddress`: Search in shipping address fields
- `advField`, `advOperator`, `advValue`: Advanced filter (operators: eq, ne, gt, gte, lt, lte, contains)
- `page`, `limit`, `sort`, `order`: Pagination and sorting

**Response (No Records)**
```json
{
  "success": true,
  "data": [],
  "message": "No record found"
}
```

**Response (With Results)**
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "page": 1,
  "pages": 3,
  "data": [...]
}
```

### Get Debit Note Summary
```http
GET /api/debit-note/summary?company=XYZ&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on D.N. Date

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 8,
    "totalTaxable": 40000,
    "totalCGST": 3600,
    "totalSGST": 3600,
    "totalIGST": 0,
    "totalValue": 47200
  }
}
```

### Duplicate Debit Note
```http
GET /api/debit-note/:id/duplicate
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Debit Note data for duplication retrieved",
  "data": {
    "customerInformation": { ... },
    "debitNoteDetails": {
       "dnPrefix": "DN",
       "dnPostfix": "2024",
       "dnDate": "2024-01-20",
       "invoiceNumber": "INV-2024-005",
       "invoiceDate": "2024-01-15",
       "docType": "Regular",
       "dnType": "Quantity Shortage",
       "deliveryMode": "Courier"
    },
    "items": [ ... ],
    "totals": { ... }
  }
}
```
> **Note**: System fields like `_id`, `dnNumber`, `status`, and timestamps are removed from the response data to facilitate creating a new record.

### Cancel Debit Note
```http
POST /api/debit-note/:id/cancel
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Debit Note cancelled successfully",
  "data": {
    "status": "Cancelled",
    ...
  }
}
```

### Restore Debit Note
```http
POST /api/debit-note/:id/restore
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Debit Note restored successfully",
  "data": {
    "status": "Active",
    ...
  }
}
```

### Download Debit Note PDF
```http
GET /api/debit-note/:id/download-pdf?original=true&duplicate=true
Authorization: Bearer <token>
```
**Query Parameters**
- `id`: Single ID or comma-separated IDs for merged PDF
- `original`, `duplicate`, `transport`, `office`: (Boolean) Include specific copies

### Share Debit Note via Email
```http
POST /api/debit-note/share-email/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "email": "customer@example.com"
}
```

### Share Debit Note via WhatsApp
```http
POST /api/debit-note/share-whatsapp/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "phone": "919876543210"
}
```

### Generate Public Link
```http
GET /api/debit-note/public-link/:id
Authorization: Bearer <token>
```

### Public View Debit Note
```http
GET /api/debit-note/view-public/:id/:token
```
> **Note**: This endpoint is unprotected and intended for customer access via secure link.

### Attachment APIs

#### Attach Files
```http
POST /api/debit-note/:id/attach-file
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Form Data**
- `attachments`: File(s) to upload

#### List Attachments
```http
GET /api/debit-note/:id/attachments
Authorization: Bearer <token>
```

#### Update (Replace) Attachment
```http
PUT /api/debit-note/:id/attachment/:attachmentId
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Form Data**
- `attachment`: New file to replace existing one

#### Delete Attachment
```http
DELETE /api/debit-note/:id/attachment/:attachmentId
Authorization: Bearer <token>
```

