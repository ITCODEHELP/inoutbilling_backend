**Base URL**: `http://localhost:5000/api`

## Credit Note

### Create Credit Note
```http
POST /api/credit-note
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "ABC Corporation",
    "address": "123 Main St",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "creditNoteDetails": {
    "cnNumber": "CN-0001",
    "cnDate": "2024-01-15",
    "invoiceNumber": "INV-2024-001",
    "invoiceDate": "2024-01-10",
    "docType": "Regular",
    "cnType": "Price Difference",
    "deliveryMode": "By Hand"
  },
  "items": [
    {
      "productName": "Product A",
      "qty": 10,
      "price": 100,
      "discount": 5,
      "igst": 18
    }
  ],
  "additionalCharges": [
    {
      "name": "Packing",
      "amount": 50,
      "tax": 9
    }
  ],
  "useSameShippingAddress": true
}
```
> **Note**: All totals (totalCreditValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using shared calculation utilities. Tax determination (IGST vs CGST+SGST) is based on place of supply comparison.

### Get Credit Notes (Paginated)
```http
GET /api/credit-note?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```

### Get Credit Note by ID
```http
GET /api/credit-note/:id
Authorization: Bearer <token>
```

### Update Credit Note
```http
PUT /api/credit-note/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Credit Note
```http
DELETE /api/credit-note/:id
Authorization: Bearer <token>
```

### Search Credit Notes
```http
GET /api/credit-note/search?company=ABC&product=Widget&fromDate=2024-01-01&toDate=2024-12-31&cnType=Price%20Difference
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, C.N. number, remarks, product names
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on C.N. Date
- `staffName`: Filter by staff name (resolves to ID)
- `cnNumber`, `creditNoteNumber`: Search in prefix/number/postfix
- `minTotal`, `maxTotal`: Filter by grand total range
- `lrNo`: Search in customFields.lr_no
- `eWayBill`: Search in customFields.eway_bill
- `itemNote`: Filter by item notes
- `remarks`: Filter by document remarks
- `gstin`: Filter by GSTIN/PAN
- `cnType`, `creditNoteType`: Filter by Credit Note Type
- `docType`: Filter by Document Type
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

### Get Credit Note Summary
```http
GET /api/credit-note/summary?company=ABC&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on C.N. Date

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 10,
    "totalTaxable": 50000,
    "totalCGST": 4500,
    "totalSGST": 4500,
    "totalIGST": 0,
    "totalValue": 59000
  }
}
```

### Duplicate Credit Note
```http
GET /api/credit-note/:id/duplicate
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Credit Note data for duplication retrieved",
  "data": {
    "customerInformation": { ... },
    "creditNoteDetails": {
       "cnPrefix": "CN",
       "cnPostfix": "2024",
       "cnDate": "2024-01-15",
       "invoiceNumber": "INV-2024-001",
       "invoiceDate": "2024-01-10",
       "docType": "Regular",
       "cnType": "Price Difference",
       "deliveryMode": "By Hand"
    },
    "items": [ ... ],
    "totals": { ... }
  }
}
```
> **Note**: System fields like `_id`, `cnNumber`, `status`, and timestamps are removed from the response data to facilitate creating a new record.

### Cancel Credit Note
```http
POST /api/credit-note/:id/cancel
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Credit Note cancelled successfully",
  "data": {
    "status": "Cancelled",
    ...
  }
}
```

### Restore Credit Note
```http
POST /api/credit-note/:id/restore
Authorization: Bearer <token>
```
**Response (Success)**
```json
{
  "success": true,
  "message": "Credit Note restored successfully",
  "data": {
    "status": "Active",
    ...
  }
}
```

### Download Credit Note PDF
```http
GET /api/credit-note/:id/download-pdf?original=true&duplicate=true
Authorization: Bearer <token>
```
**Query Parameters**
- `id`: Single ID or comma-separated IDs for merged PDF
- `original`, `duplicate`, `transport`, `office`: (Boolean) Include specific copies

### Share Credit Note via Email
```http
POST /api/credit-note/:id/share-email
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "email": "customer@example.com"
}
```

### Share Credit Note via WhatsApp
```http
POST /api/credit-note/:id/share-whatsapp
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
GET /api/credit-note/:id/public-link
Authorization: Bearer <token>
```

### Public View Credit Note
```http
GET /api/credit-note/view-public/:id/:token
```
> **Note**: This endpoint is unprotected and intended for customer access via secure link.

### Attachment APIs

#### Attach Files
```http
POST /api/credit-note/:id/attach-file
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Form Data**
- `attachments`: File(s) to upload

#### List Attachments
```http
GET /api/credit-note/:id/attachments
Authorization: Bearer <token>
```

#### Update (Replace) Attachment
```http
PUT /api/credit-note/:id/attachment/:attachmentId
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Form Data**
- `attachment`: New file to replace existing one

#### Delete Attachment
```http
DELETE /api/credit-note/:id/attachment/:attachmentId
Authorization: Bearer <token>
```

