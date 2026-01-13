**Base URL**: `http://localhost:5000/api`

> [!NOTE]
> All **GSTIN & E-Way Bill Auto-Fill** APIs are available across `/api/customers`, `/api/vendor`, and `/api/customer-vendor` endpoints.

---

## Search API (Universal)

> [!TIP]
> This feature is available identically across `/customers`, `/vendor`, and `/customer-vendor`. It extends existing listing behavior without modifying existing API structures.

### Search Parameters
Available via **Query Parameters** (GET) or **Request Body** (POST/GET). All filters use case-insensitive partial matching.

| Parameter | Type | Description |
| :--- | :--- | :--- |
| `search` | String | Generic match for Name or GSTIN |
| `companyName` | String | Filter by Company Name |
| `gstin` | String | Filter by GSTIN |
| `companyType` | String | Filter by Company/Registration Type |
| `contactPerson` | String | Filter by Contact Person |
| `licenseNo` | String | Filter by License Number |
| `customField1` | String | Filter by Custom Field 1 |
| `customField2` | String | Filter by Custom Field 2 |
| `staffName` | String | Filter by Staff Name (matches Staff collection) |
| `showAll` | Boolean | If `true`, returns all records bypassing search filters |
| `page` | Number | Page number for pagination (Default: 1) |
| `limit` | Number | Records per page (Default: 10) |

### Summary Response Format
When any search is performed (or `showAll` is used), the response includes a `summary` object containing counts from the *filtered* dataset across all models.

```json
{
  "success": true,
  "summary": {
    "total": 15,
    "customer": 10,
    "vendor": 3,
    "customerVendor": 2
  },
  "count": 10,
  "totalRecords": 100,
  "page": 1,
  "pages": 10,
  "data": [ ... ]
}
```

### Example: Unified Search
```http
GET /api/customers?search=Acme&staffName=Rajesh
Authorization: Bearer <token>
```

---

## Ledger Report

### Get Ledger Statement
```http
GET /customer-vendor/ledger?name=Acme%20Corp&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "user": { "companyName": "...", "address": "...", "city": "...", "state": "...", "gstNumber": "..." },
  "target": { "companyName": "Acme Corp", "gstin": "...", "address": "..." },
  "rows": [
    { "date": "2024-01-10", "particulars": "INV-001", "voucherType": "Sale Invoice", "invoiceNo": "INV-001", "debit": 1500, "credit": 0, "balance": 1500 }
  ],
  "totals": { "openingBalance": 0, "totalDebit": 1500, "totalCredit": 0, "closingBalance": 1500 }
}
```

### Print/Download Ledger (PDF)
```http
GET /customer-vendor/ledger/print?name=Acme%20Corp&fromDate=...&toDate=...
Authorization: Bearer <token>
```
- Returns `application/pdf` binary stream.

### Email Ledger
```http
POST /customer-vendor/ledger/email
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "Acme Corp",
    "fromDate": "2024-01-01",
    "toDate": "2024-12-31"
}
```

---

## Document Management

### Upload Document
```http
POST /customer-vendor/documents/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

Body:
- entityRef (string): ID or Name of Customer/Vendor
- file (file): File to upload (Max 10MB)
```
**Response**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "entityId": "...",
    "entityType": "Customer",
    "originalName": "contract.pdf",
    "storedName": "173678..." ,
    "previewUrl": "http://.../uploads/customer-vendor/..."
  }
}
```

### List Documents
```http
GET /customer-vendor/documents/:entityRef
Authorization: Bearer <token>
```
- `:entityRef` can be the ID or Name of the Customer/Vendor.

### Delete Document
```http
DELETE /customer-vendor/documents/delete/:documentId
Authorization: Bearer <token>
```

---

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
