**Base URL**: `http://localhost:5000/api`

## Bank Details

### Create New Bank Details (**NEW**)
```http
POST /api/bank-details
Authorization: Bearer <token>
Content-Type: application/json
```
**Body** (Only allowed for new records, do NOT send `bankId` or `_id`)
```json
{
  "accountName": "John Doe",
  "bankName": "SBI",
  "accountNumber": "123456",
  "ifscCode": "SBIN0001234",
  "upiId": "john@sbi"
}
```

### Update Bank Details (**NEW**)
```http
PUT /api/bank-details/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "accountName": "John Doe Updated",
  "bankName": "SBI",
  "accountNumber": "123456"
}
```


### Get All Bank Details
```http
GET /api/bank-details
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "_id": "60d0fe4f5311236168a109ca",
      "bankId": "550e8400-e29b-41d4-a716-446655440000",
      "bankName": "SBI",
      "accountName": "John Doe",
      "accountNumber": "1234567890",
      "ifscCode": "SBIN0001234",
      "branchName": "Mumbai Main",
      "amount": 0,
      "lastTransactionDate": "2023-10-26T12:00:00.000Z",
      "importDate": "2023-01-15T10:00:00.000Z",
      "bankLogo": "http://localhost:5000/bank-logos/sbi.png"
    }
  ]
}
```

### Search Bank Transactions (**NEW**)
```http
GET /api/bank-details/transactions/search/:id
Authorization: Bearer <token>
```
**Query Parameters (Optional)**
- `dateFrom`: Start date (YYYY-MM-DD)
- `dateTo`: End date (YYYY-MM-DD)
- `description`: Partial match on remarks or company name
- `type`: `credit` or `debit`
- `amount`: Exact amount
- `minAmount`: Minimum amount range
- `maxAmount`: Maximum amount range
- `status`: `auto_match`, `matched`, `unmatched`, `ACTIVE`
- `page`: Page number (default 1)
- `limit`: Items per page (default 10)

**Example Request**
`GET /api/bank-details/transactions/search?type=credit&status=matched&dateFrom=2023-01-01`

**Response**
```json
{
  "success": true,
  "count": 2,
  "total": 50,
  "currentPage": 1,
  "totalPages": 5,
  "data": [
    {
      "_id": "...",
      "paymentDate": "2023-10-25T00:00:00.000Z",
      "amount": 5000,
      "paymentType": "bank",
      "remarks": "Payment from Client A",
      "companyName": "Client A",
      "transactionType": "credit",
      "status": "matched"
    },
    {
      "_id": "...",
      "paymentDate": "2023-10-24T00:00:00.000Z",
      "amount": 200,
      "paymentType": "bank",
      "remarks": "Bank Charges",
      "companyName": "Bank",
      "transactionType": "debit",
      "status": "matched"
    }
  ]
}

### Get Single Bank Detail (**NEW**)
```http
GET /api/bank-details/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "_id": "60d0fe4f5311236168a109ca",
    "bankId": "550e8400-e29b-41d4-a716-446655440000",
    "bankName": "SBI",
    "accountName": "John Doe",
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "branchName": "Mumbai Main",
    "bankLogo": "http://localhost:5000/bank-logos/sbi.jpg"
  }
}
```

### Add Bank Transaction (**NEW**)
*Adds a transaction directly to the specified Bank Detail record ID.*
```http
POST /api/bank-details/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Parameters**
- `id`: The Bank Detail ID (UUID or MongoDB ID)

**Body**
```json
{
  "date": "2023-10-27",
  "transactionType": "Credit",
  "amount": 5000,
  "description": "Payment from Client X",
  "remarks": "Invoice #123",
  "paymentStatus": "matched"
}
```
**Response**
```json
{
  "success": true,
  "message": "Transaction added successfully",
  "data": {
    "date": "2023-10-27T00:00:00.000Z",
    "amount": 5000,
    "transactionType": "Credit",
    "description": "Payment from Client X",
    "remarks": "Invoice #123",
    "paymentStatus": "matched",
    "_id": "..."
  }
}
```

### Update Bank Transaction (**NEW**)
```http
PUT /api/bank-details/transactions/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Body (Partial Updates)**
```json
{
  "amount": 6000,
  "paymentStatus": "matched"
}
```
**Response**
```json
{
  "success": true,
  "message": "Transaction updated successfully",
  "data": { ... }
}
```

### Delete Bank Transaction (**NEW**)
```http
DELETE /api/bank-details/transactions/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "message": "Transaction deleted successfully"
}
```

### Transaction Import (**NEW**)

#### Get Sample File
*Returns a sample Excel file for bulk import.*
```http
GET /api/bank-statements/sample
Authorization: Bearer <token>
```
**Response**
- Returns a downloadable `.xlsx` file.

#### Import Bank Statement
*Uploads and parses a bank statement (CSV/XLS/XLSX).*
```http
POST /api/bank-statements/import
Authorization: Bearer <token>
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```
**Form Data**
- `file`: (File, Required) The CSV or Excel file to upload.

**Response**
```json
{
  "success": true,
  "message": "File imported successfully",
  "data": {
    "importId": "651a...",
    "transactions": [
      {
        "date": "2024-05-06T00:00:00.000Z",
        "description": "UPI-3037...",
        "debit": 0,
        "credit": 1500,
        "balance": 0,
        "status": "valid"
      },
      ...
    ]
  }
}
```

### Export Bank Statement (**NEW**)

#### Export to Excel
*Exports bank transactions to an Excel file.*
```http
GET /api/bank-statements/export/excel/:id
Authorization: Bearer <token>
```
**Query Parameters**
Same as Search API (`dateFrom`, `dateTo`, `description`, `type`, `amount`, `status`).

**Response**
- Returns a downloadable `.xlsx` file.

#### Export to PDF
*Exports bank transactions to a PDF file.*
```http
GET /api/bank-statements/export/pdf/:id
Authorization: Bearer <token>
```
**Query Parameters**
Same as Search API.

**Response**
- Returns a downloadable `.pdf` file.
