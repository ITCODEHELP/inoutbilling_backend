**Base URL**: `http://localhost:5000/api`

> [!NOTE]
> All **GSTIN & E-Way Bill Auto-Fill** APIs are available across `/api/customers`, `/api/vendor`, and `/api/customer-vendor` endpoints.

## Customer

### Download Customers
```http
GET /customers/download-customers
Authorization: Bearer <token>
```
**Response**
- File download (`customers.xlsx`)

### Create Customer
```http
POST /customers
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "Acme Corp",
  "companyType": "Retail",
  "gstin": "27ABCDE...",
  "billingAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001"
  },
  "shippingAddress": {}
}
```
> **Note**: If `gstin` is not provided, the system will automatically generate it if valid `pan` and `billingAddress.state` are present.

### Get All Customers
```http
GET /customers
Authorization: Bearer <token>
```
**Response**
```json
[ { "companyName": "Acme Corp", ... } ]
```

### Get Customer by ID
```http
GET /customers/:id
Authorization: Bearer <token>
```

### Update Customer
```http
PUT /customers/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "companyName": "New Name" }
```
> **Note**: If `gstin` is currently empty and not provided in the update, providing `pan` and `billingAddress.state` will trigger auto-generation.

### Delete Customer
```http
DELETE /customers/:id
Authorization: Bearer <token>
```
**Response**
```json
{ "message": "Customer removed" }
```

---

## Import

### Import Customers
```http
POST /import/customers
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body**
- `file`: (Select an Excel/CSV file)

**Response**
```json
{
  "recordNumber": 10,
  "processedRange": "1-10",
  "statusSummary": "Completed",
  "action": [ ... ],
  "summary": { "total": 10, "success": 8, "duplicate": 1, "invalid": 1 }
}
```

---

## Vendor

### Create Vendor
```http
POST /vendor/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "...",
  "gstin": "...",
  "billingAddress": { ... }
}
```
> **Note**: If `gstin` is not provided, the system will automatically generate it if valid `pan` and `billingAddress.state` are present.

### Get Vendors
```http
GET /vendor
Authorization: Bearer <token>
```

### Get Vendor by ID
```http
GET /vendor/:id
Authorization: Bearer <token>
```

---

## Customer-Vendor

### Create Customer-Vendor
```http
POST /customer-vendor/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "...",
  "billingAddress": { "state": "Maharashtra", "country": "India", ... },
  "pan": "..."
}
```
> **Note**: Triggers GSTIN auto-generation if `gstin` is missing but `pan` and `state` (in billingAddress) are provided.

### Get Customer-Vendors
```http
GET /customer-vendor
Authorization: Bearer <token>
```

### GSTIN Auto-Fill (GET)
```http
GET /customer-vendor/gst-autofill/:gstin
Authorization: Bearer <token>
```

### GSTIN Auto-Fill (POST)
```http
POST /customer-vendor/gst-autofill
Authorization: Bearer <token>
Content-Type: application/json

{
  "gstin": "27ABCDE1234F1Z5"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "companyName": "MOCK BUSINESS SOLUTIONS PVT LTD",
    "legalName": "...",
    "tradeName": "...",
    "gstin": "27ABCDE1234F1Z5",
    "pan": "ABCDE1234F",
    "registrationType": "Regular",
    "billingAddress": {
        "street": "101, TECH PLAZA, MAIN ROAD",
        "landmark": "NEAR METRO STATION",
        "city": "Pune",
        "state": "Maharashtra",
        "pincode": "411001",
        "country": "India"
    },
    "contactPerson": "John Doe",
    "contactNo": "9876543210",
    "email": "demo@mockbusiness.com"
  }
}
```

### E-Way Bill Auto-Fill (GET)
```http
GET /customer-vendor/ewaybill-autofill/:ewayBillNo
Authorization: Bearer <token>
```

### E-Way Bill Auto-Fill (POST)
```http
POST /customer-vendor/ewaybill-autofill
Authorization: Bearer <token>
Content-Type: application/json

{
  "ewayBillNo": "123456789012"
}
```

**Response**
```json
{
  "success": true,
  "data": {
    "ewayBillNo": "123456789012",
    "billDate": "13/01/2026",
    "distance": 350,
    "from": {
        "companyName": "SOURCE LOGISTICS",
        "gstin": "27SOURCE1234G1Z",
        "state": "Maharashtra",
        "city": "Pune",
        "pincode": "411001"
    },
    "to": {
        "companyName": "DESTINATION RETAIL",
        "gstin": "24DEST1234F1Z5",
        "state": "Gujarat",
        "city": "Surat",
        "pincode": "395006"
    }
  }
}
```
