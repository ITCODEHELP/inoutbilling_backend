**Base URL**: `http://localhost:5000/api`

## Packing List

### Create Packing List
```http
POST /api/packing-list
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "Acme Corp",
    "address": "123 Street",
    "contactPerson": "John Doe",
    "phone": "9876543210",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra"
  },
  "packingListDetails": {
    "prefix": "PK",
    "number": "001",
    "invoiceNumber": "INV-101",
    "invoiceDate": "2024-01-01",
    "invoiceType": "Regular"
  },
  "items": [
    {
      "productDescription": "Widget A",
      "qty": 100,
      "grossWeight": 50,
      "netWeight": 45,
      "productGroup": "Electronics"
    }
  ],
  "totals": {
    "totalPackages": 1,
    "totalGrossWeight": 50,
    "totalNetWeight": 45
  },
  "saveAndPrint": true
}
```
> **Note**: Set `saveAndPrint: true` to generate a PDF and store the URL in `pdfUrl`.

### Get Packing Lists (with Search)
```http
GET /api/packing-list?company=Acme&productGroup=Electronics&invoiceNo=INV-101&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`, `product`, `productGroup`, `invoiceNo`, `challanNo`, `itemNote`, `remarks`, `gstin`, `invoiceType`
- `fromDate`, `toDate` (based on `invoiceDate`)
- `staffName` (resolves to staff owner)
- `page`, `limit`, `sort`, `order`

### Download Packing List PDF
```http
GET /api/packing-list/:id/download
Authorization: Bearer <token>
```

### Delete Packing List
```http
DELETE /api/packing-list/:id
Authorization: Bearer <token>
```

