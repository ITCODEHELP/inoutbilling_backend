**Base URL**: `http://localhost:5000/api`

## Multi-Currency Export Invoice

### Create Multi-Currency Export Invoice
```http
POST /api/export-invoice
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "Global Export Corp",
    "address": "789 Export Street, Mumbai",
    "contactPerson": "John Doe",
    "phone": "+91-9876543210",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "invoiceDetails": {
    "invoiceType": "Export Invoice (With IGST)",
    "invoicePrefix": "EXP",
    "invoiceNumber": "EXP-0001",
    "invoicePostfix": "",
    "date": "2024-01-25",
    "deliveryMode": "Sea Freight"
  },
  "currency": {
    "code": "AED",
    "symbol": "AED"
  },
  "exportShippingDetails": {
    "shipBillNo": "SB-2024-001",
    "shipBillDate": "2024-01-20",
    "shipPortCode": "INMUM",
    "preCarriageBy": "Road",
    "placeOfPreCarriage": "Mumbai",
    "vesselOrFlightNo": "MV-OCEAN-123",
    "portOfLoading": "Mumbai Port",
    "portOfDischarge": "Dubai Port",
    "finalDestination": "Dubai, UAE",
    "countryOfOrigin": "India",
    "countryOfFinal": "UAE",
    "weightKg": 5000,
    "packages": 50
  },
  "items": [
    {
      "productName": "Textile Goods",
      "productGroup": "Textiles",
      "itemNote": "Export quality",
      "hsnSac": "5208",
      "qty": 100,
      "uom": "PCS",
      "price": 50,
      "discount": 5,
      "igst": 0
    }
  ],
  "additionalCharges": [
    {
      "name": "Freight Charges",
      "amount": 500,
      "tax": 0
    }
  ],
  "useSameShippingAddress": false,
  "shippingAddress": {
    "street": "789 Export Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001"
  },
  "staff": "60f1b2c3d4e5f6a7b8c9d0e1",
  "branch": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e2",
    "state": "Maharashtra"
  },
  "bankDetails": {
    "bankName": "Export Bank",
    "accountNumber": "1234567890",
    "ifscCode": "EXBK0001234"
  },
  "termsTitle": "Terms & Conditions",
  "termsDetails": [
    "Payment within 30 days",
    "FOB Mumbai Port"
  ],
  "documentRemarks": "Export invoice for UAE shipment",
  "shareOnEmail": false,
  "customFields": {}
}
```
**Invoice Type Options**
- `Export Invoice (With IGST)`: IGST is entered by user, CGST/SGST are derived from IGST when applicable (CGST = IGST ÷ 2, SGST = IGST ÷ 2). Manual CGST/SGST entry is prevented.
- `Export Invoice (Without IGST)`: No IGST applied, no CGST/SGST.

**Currency Support**
- Supported currency codes: `AED`, `USD`, `EUR`, `GBP`, `SAR`, `INR`
- Currency is stored in database and reflected in totals and "total in words"

**Required Fields**
- `customerInformation.ms`: Customer name (M/S)
- `customerInformation.placeOfSupply`: Place of supply
- `invoiceDetails.invoiceType`: Must be "Export Invoice (With IGST)" or "Export Invoice (Without IGST)"
- `invoiceDetails.invoiceNumber`: Invoice number (auto-generated if not provided)
- `invoiceDetails.date`: Invoice date
- `currency.code`: Currency code (default: "AED")
- `exportShippingDetails.shipBillNo`: Shipping Bill Number
- `exportShippingDetails.shipBillDate`: Shipping Bill Date
- `exportShippingDetails.shipPortCode`: Port Code
- `exportShippingDetails.portOfLoading`: Port of Loading
- `exportShippingDetails.portOfDischarge`: Port of Discharge
- `exportShippingDetails.finalDestination`: Final Destination
- `exportShippingDetails.countryOfOrigin`: Country of Origin
- `exportShippingDetails.countryOfFinal`: Country of Final Destination
- `items`: Array of items (at least one item required)
  - `productName`: Required
  - `qty`: Required, must be > 0
  - `price`: Required, must be > 0

> **Note**: All totals (totalInvoiceValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using multi-currency export invoice calculation utilities. For Export Invoice (With IGST), IGST is entered by user and CGST/SGST are derived from IGST when applicable (CGST = IGST ÷ 2, SGST = IGST ÷ 2). Manual CGST/SGST entry is prevented. Currency is reflected in "total in words" (e.g., "Dirhams One Thousand Only" for AED).

**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice created successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "userId": "60f1b2c3d4e5f6a7b8c9d0e0",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": {
      "code": "AED",
      "symbol": "AED"
    },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": {
      "totalInvoiceValue": 5250,
      "totalTaxable": 4750,
      "totalTax": 0,
      "totalCGST": 0,
      "totalSGST": 0,
      "totalIGST": 0,
      "roundOff": 0,
      "grandTotal": 5250,
      "totalInWords": "Dirhams Five Thousand Two Hundred Fifty Only"
    },
    "createdAt": "2024-01-25T10:00:00.000Z",
    "updatedAt": "2024-01-25T10:00:00.000Z"
  }
}
```

### Get Multi-Currency Export Invoices (Paginated)
```http
GET /api/export-invoice?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```
**Query Parameters**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field (default: createdAt)
- `order`: Sort order - `asc` or `desc` (default: desc)

**Response**
```json
{
  "success": true,
  "total": 50,
  "page": 1,
  "pages": 5,
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
      "customerInformation": { ... },
      "invoiceDetails": { ... },
      "currency": { ... },
      "exportShippingDetails": { ... },
      "items": [ ... ],
      "totals": { ... }
    }
  ]
}
```

### Get Multi-Currency Export Invoice by ID
```http
GET /api/export-invoice/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": { ... },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": { ... },
    "staff": {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
      "fullName": "John Smith"
    }
  }
}
```

### Update Multi-Currency Export Invoice
```http
PUT /api/export-invoice/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
Same structure as Create Multi-Currency Export Invoice. All fields are optional - only provided fields will be updated.

**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice updated successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": { ... },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": { ... },
    "updatedAt": "2024-01-25T11:00:00.000Z"
  }
}
```

### Delete Multi-Currency Export Invoice
```http
DELETE /api/export-invoice/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice deleted successfully"
}
```

### Search Multi-Currency Export Invoices
```http
GET /api/export-invoice/search?company=Global&product=Textile&fromDate=2024-01-01&toDate=2024-12-31&invoiceType=Export%20Invoice%20(With%20IGST)&currency=AED
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, invoice number, remarks, product names, item notes, shipping bill number, ports
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on invoice date
- `staffName`: Filter by staff name (resolves to ID)
- `invoiceNumber`: Search in prefix/number/postfix
- `invoiceType`: Filter by invoice type - "Export Invoice (With IGST)" or "Export Invoice (Without IGST)"
- `currency`: Filter by currency code (e.g., AED, USD, EUR)
- `minTotal`, `maxTotal`: Filter by grand total range
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
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
      "customerInformation": { ... },
      "invoiceDetails": { ... },
      "currency": { ... },
      "exportShippingDetails": { ... },
      "items": [ ... ],
      "totals": { ... }
    }
  ]
}
```

### Get Multi-Currency Export Invoice Summary
```http
GET /api/export-invoice/summary?company=Global&fromDate=2024-01-01&toDate=2024-12-31&invoiceType=Export%20Invoice%20(With%20IGST)&currency=AED
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on invoice date
- `invoiceType`: Filter by invoice type
- `currency`: Filter by currency code

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 15,
    "totalTaxable": 75000,
    "totalCGST": 0,
    "totalSGST": 0,
    "totalIGST": 6750,
    "totalValue": 81750
  }
}
```

