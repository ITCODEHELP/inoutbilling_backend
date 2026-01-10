**Base URL**: `http://localhost:5000/api`

## Sale Invoice

### Create Invoice
```http
POST /sale-invoice/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": { "ms": "...", "placeOfSupply": "..." },
  "invoiceDetails": { "invoiceNumber": "...", "date": "..." },
  "items": [ { "productName": "...", "qty": 1, "price": 100 } ],
  "totals": { "grandTotal": 100 },
  "paymentType": "CASH",
  "shareOnEmail": true,
  "createDeliveryChallan": true
}
```

### Create & Print Invoice
```http
POST /sale-invoice/create-print
Authorization: Bearer <token>
Content-Type: application/json
```

### Get Invoices
```http
GET /sale-invoice
Authorization: Bearer <token>
```

### Get Invoice by ID
```http
GET /sale-invoice/:id
Authorization: Bearer <token>
```

### Delete Invoice
```http
DELETE /sale-invoice/:id
Authorization: Bearer <token>
```

### Get Summary
```http
GET /sale-invoice/summary
Authorization: Bearer <token>
```
**Query Params**: `company`, `invoiceType`, `paymentType`, `fromDate`, `toDate`

