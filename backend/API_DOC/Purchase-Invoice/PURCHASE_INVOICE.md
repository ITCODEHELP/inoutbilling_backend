**Base URL**: `http://localhost:5000/api`

## Purchase Invoice

### Create Purchase Invoice
```http
POST /purchase-invoice/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "vendorInformation": { "ms": "...", "placeOfSupply": "..." },
  "invoiceDetails": { "invoiceNumber": "...", "date": "..." },
  "items": [ { "productName": "...", "qty": 1, "price": 100 } ],
  "totals": { "grandTotal": 100 },
  "paymentType": "CASH"
}
```

### Get Purchase Invoices
```http
GET /purchase-invoice
Authorization: Bearer <token>
```

### Create & Print Purchase Invoice
```http
POST /purchase-invoice/create-print
Authorization: Bearer <token>
Content-Type: application/json
```

### Get Summary
```http
GET /purchase-invoice/summary
Authorization: Bearer <token>
```

### Search Purchase Invoices
```http
GET /purchase-invoice/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `productName`, `fromDate`, `toDate`, `invoiceNumber`

### Upload & Extract (AI)
```http
POST /purchase-invoice/upload-ai
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body**
- `invoice`: (PDF File)

### Confirm Extraction
```http
POST /purchase-invoice/confirm-ai
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "extractionId": "...", "continue": "Yes" }
```

### Get Purchase Invoice by ID
```http
GET /purchase-invoice/:id
Authorization: Bearer <token>
```

### Delete Purchase Invoice
```http
DELETE /purchase-invoice/:id
Authorization: Bearer <token>
```

---

## Purchase Invoice Custom Fields

### Save Custom Fields
```http
POST /purchase-invoice/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "fields": [
    { "name": "Warranty", "type": "TEXT", "status": "Active" },
    { "name": "Type", "type": "DROPDOWN", "options": ["A", "B"] }
  ]
}
```

### Get Custom Fields
```http
GET /purchase-invoice/custom-fields
Authorization: Bearer <token>
```

---

## Additional Charges

### Create Charge
```http
POST /additional-charges
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "name": "Shipping",
  "price": 100,
  "hsnSacCode": "9965",
  "tax": 18,
  "isServiceItem": true
}
```

### Get Charges
```http
GET /additional-charges
Authorization: Bearer <token>
```

