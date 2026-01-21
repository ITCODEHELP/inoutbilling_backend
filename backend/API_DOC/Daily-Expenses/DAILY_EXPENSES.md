**Base URL**: `http://localhost:5000/api`

# [DAILY EXPENSE MODULE]

## Create Expense
`POST` /api/daily-expenses

### Header
> Authorization: Bearer <token>
> Content-Type: multipart/form-data

### Form-Data
- `expenseNo`: String (Required)
- `expenseDate`: Date (Required)
- `category`: String (Required)
- `isGstBill`: Boolean (true/false)
- `party`: ObjectId (Vendor/Company ID, Optional)
- `paymentType`: Enum (CASH, CHEQUE, ONLINE, BANK)
- `remarks`: String
- `attachment`: File (Image/Doc/PDF)
- `items`: JSON String (Array of objects: { name, note, quantity, price, amount })
- `customFields`: JSON String (Object: { fieldId: value, ... })
- `roundOff`: Number
- `grandTotal`: Number
- `amountInWords`: String
- `original`: Boolean (Optional, for print)
- `duplicate`: Boolean (Optional, for print)
- `transport`: Boolean (Optional, for print)
- `office`: Boolean (Optional, for print)

### Response
```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": { ... }
}
```

## List Expenses
`GET` /api/daily-expenses?page=1&limit=10

### Header
> Authorization: Bearer <token>

### Response
```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "totalPages": 5,
  "currentPage": 1,
  "data": [ ... ]
}
```

## Search Expenses
`GET` /api/daily-expenses/search

### Query Parameters (All Optional)
- `companyName`: String (Partial, case-insensitive match on Vendor name)
- `staffName`: String (Partial, case-insensitive match on Staff name)
- `category`: String (Partial, case-insensitive match)
- `fromDate`: YYYY-MM-DD
- `toDate`: YYYY-MM-DD
- `title`: String (Search in remarks, description, or expenseNo)
- `itemNote`: String (Search inside item notes)
- `paymentType`: Enum (CASH, CHEQUE, ONLINE, BANK)
- `minAmount`: Number (Filter by grandTotal)
- `maxAmount`: Number (Filter by grandTotal)
- `expenseNo`: String (Partial match)
- `cf_<fieldId>`: Value (for custom fields)

### Response
```json
{
  "success": true,
  "count": 5,
  "data": [ ... ]
}
```

## Expense Summary
`GET` /api/daily-expenses/summary

### Query Parameters
- Supports the same filters as the **Search Expenses** API.

### Response
```json
{
  "success": true,
  "data": {
    "totalTransactions": 10,
    "totalValue": 5000
  }
}
```

## Manage Custom Fields

### Get All Fields
`GET` /api/daily-expenses/custom-fields

### Create Field
`POST` /api/daily-expenses/custom-fields
Body:
```json
{
  "name": "Field Name",
  "type": "TEXT|DATE|DROPDOWN",
  "options": ["Option1", "Option2"], // if DROPDOWN
  "required": true,
  "print": true,
  "orderNo": 1
}
```

### Update Field
`PUT` /api/daily-expenses/custom-fields/:id

### Delete Field
`DELETE` /api/daily-expenses/custom-fields/:id

## Manage Item Columns

### Get All Item Columns
`GET` /api/daily-expenses/item-columns

### Create Item Column
`POST` /api/daily-expenses/item-columns
Body:
```json
{
  "name": "Column Name",
  "type": "TEXT|NUMBER|DROPDOWN",
  "options": ["Option1", "Option2"], // if DROPDOWN
  "orderNo": 1
}
```

### Update Item Column
`PUT` /api/daily-expenses/item-columns/:id

### Delete Item Column
`DELETE` /api/daily-expenses/item-columns/:id

## Import Expenses
`POST` /api/daily-expenses/import

### Content-Type
`multipart/form-data`

### Body
- `file`: The Excel file (XLS/XLSX).

### Excel Format (Columns)
| Column | Description |
| --- | --- |
| `expenseNo` | Unique expense number (Req) |
| `expenseDate` | YYYY-MM-DD (Opt) |
| `category` | Expense Category (Opt) |
| `party` | Company/Vendor Name (Opt) |
| `staffName` | Staff Full Name (Opt) |
| `paymentType` | CASH, CHEQUE, ONLINE, BANK (Opt) |
| `remarks` | Expense remarks/title (Opt) |
| `description` | Detailed description (Opt) |
| `item_name` | Name of the expense item |
| `item_note` | Note for the item |
| `quantity` | Item quantity (Numeric) |
| `price` | Unit price (Numeric) |
| `roundOff` | Rounding amount (Opt) |
| `amountInWords` | Amount in words (Opt) |
| `cf_<fieldId>` | Value for dynamic custom field |

> [!NOTE]
> For multiple items in one expense, repeat the same `expenseNo` in multiple rows. The first row for an `expenseNo` will be used for header details.

### Response
```json
{
  "success": true,
  "message": "Import completed. 5 imported, 0 failed.",
  "results": {
    "totalRows": 5,
    "imported": 5,
    "failed": 0,
    "errors": []
  }
}
```

## Daily Expense Enhancement
`GET` /api/daily-expenses/:id/print
- Returns PDF receipt.
- Also supported via `print: true` in `POST /api/daily-expenses`.

### Query Parameters (for GET) / Body (for POST)
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

## Import History
`GET` /api/daily-expenses/import-history

### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "677b63fbd55e8d53066986e8",
      "userId": "677618999818b2cb188e02d8",
      "fileName": "expenses.xlsx",
      "totalRows": 5,
      "importedCount": 4,
      "failedCount": 1,
      "errorLogs": [...],
      "status": "Completed",
      "createdAt": "2026-01-06T10:45:00.000Z",
      "updatedAt": "2026-01-06T10:45:05.000Z"
    }
  ]
}
```

---

# [EXPENSE CATEGORY MANAGEMENT]

## Get All Expense Categories
`GET` /api/expense-categories

### Header
> Authorization: Bearer <token>

### Query Parameters (Optional)
- `search`: String (Partial, case-insensitive match on category name)

### Description
This endpoint **derives unique expense categories dynamically from the DailyExpense table** and merges them with the ExpenseCategory master table. It groups all expenses by their `category` field to get unique category names, then retrieves or creates status records from the ExpenseCategory table for each unique category.

**How it works:**
1. Aggregates unique category names from user's expenses
2. For each unique category, checks if a status record exists in ExpenseCategory
3. If no status record exists, creates one with default "Active" status
4. Filters out deleted categories (isDeleted = true)
5. Returns category list with name, categoryId, and current status

**Note:** Categories appear automatically when used in expenses, but can also be manually created.

### Response
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "_id": "categoryId123",
      "categoryId": "categoryId123",
      "categoryName": "Travel",
      "name": "Travel",
      "status": "Active",
      "isDeleted": false,
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z"
    },
    {
      "_id": "categoryId456",
      "categoryId": "categoryId456",
      "categoryName": "Fuel",
      "name": "Fuel",
      "status": "Active",
      "isDeleted": false,
      "createdAt": "2026-01-20T10:00:00.000Z",
      "updatedAt": "2026-01-20T10:00:00.000Z"
    }
  ]
}
```

## Create Expense Category
`POST` /api/expense-categories

### Header
> Authorization: Bearer <token>
> Content-Type: application/json

### Description
Manually create a new expense category in the master table. Categories can also be created automatically when used in expenses.

### Request Body
```json
{
  "name": "Office Supplies"
}
```

### Response
```json
{
  "success": true,
  "message": "Category created successfully",
  "data": {
    "_id": "categoryId789",
    "userId": "userId123",
    "name": "Office Supplies",
    "status": "Active",
    "isDeleted": false,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:00:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Category already exists"
}
```

## Update Expense Category
`PUT` /api/expense-categories/:id

### Header
> Authorization: Bearer <token>
> Content-Type: application/json

### Description
Update an existing expense category name. This does not affect existing expense records.

### Request Body
```json
{
  "name": "Business Travel"
}
```

### Response
```json
{
  "success": true,
  "message": "Category updated successfully",
  "data": {
    "_id": "categoryId123",
    "userId": "userId123",
    "name": "Business Travel",
    "status": "Active",
    "isDeleted": false,
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:30:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Category name already exists"
}
```

## Delete Expense Category
`DELETE` /api/expense-categories/:id

### Header
> Authorization: Bearer <token>

### Description
**Soft delete** an expense category. The category is marked as deleted (isDeleted = true) but not removed from the database. Deleted categories are hidden from the listing by default.

**Protection:** Cannot delete a category if it is linked to existing expenses. You must remove or reassign those expenses first.

### Response (Success)
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

### Error Response (Linked to Expenses)
```json
{
  "success": false,
  "message": "Cannot delete category. It is linked to 15 expense(s). Please remove or reassign those expenses first."
}
```

### Error Response (Not Found)
```json
{
  "success": false,
  "message": "Category not found"
}
```

## Toggle Category Status
`PATCH` /api/expense-categories/:id/toggle-status

### Header
> Authorization: Bearer <token>

### Description
Toggles the category status between `Active` and `Inactive`. When a category is clicked in the UI, this endpoint is called to switch its status.

### Response
```json
{
  "success": true,
  "message": "Category status updated to Inactive",
  "data": {
    "_id": "categoryId123",
    "userId": "userId123",
    "name": "Travel",
    "status": "Inactive",
    "createdAt": "2026-01-20T10:00:00.000Z",
    "updatedAt": "2026-01-20T10:30:00.000Z"
  }
}
```

### Features
- Categories are listed uniquely by `categoryName`
- Each category displays current status (Active/Inactive)
- Clicking status toggles between Active and Inactive
- All data is user-based (company-based)
- Response includes `categoryId`, `categoryName`, and `status`
- Deleted categories are excluded from listing

### Attach File to Expense
Use this API to upload or replace an attachment for a daily expense.

```http
POST /daily-expenses/attach-file
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data**
| Key | Type | Description |
| :--- | :--- | :--- |
| `attachment` | File | **Required**. Image or Document (jpg, png, pdf, doc) |
| `expenseId` | ObjectId | **Optional**. Existing Expense ID to attach/replace file for |

**Response**
```json
{
    "success": true,
    "message": "File attached successfully",
    "data": {
        "attachment": "uploads/expenses/expense-1721532.jpg",
        "fileName": "receipt.jpg",
        "mimetype": "image/jpeg",
        "size": 102456
    }
}
```

### Update Attachment
To replace an existing attachment, use the **Attach File to Expense** API (`POST /daily-expenses/attach-file`).
- Provide the same `expenseId`.
- The new file will replace the old one (which will be deleted from storage).

### Get Attachment
Use this API to retrieve attachment details for a daily expense.

```http
GET /daily-expenses/attachment/:id
Authorization: Bearer <token>
```

**Response**
```json
{
    "success": true,
    "data": {
        "attachment": "uploads/expenses/expense-1721532.jpg",
        "fileName": "expense-1721532.jpg",
        "mimetype": "image/jpeg"
    }
}
```

### Delete Attachment
Use this API to remove an attachment from a daily expense.

```http
DELETE /daily-expenses/attachment/:id
Authorization: Bearer <token>
```

**Response**
```json
{
    "success": true,
    "message": "Attachment deleted successfully"
}
```

### Download Expense PDF
`GET` /daily-expenses/:id/download-pdf

**Query Parameters**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

Response: PDF File Stream (Content-Disposition: attachment)

### Share Expense via Email
`POST` /daily-expenses/:id/share-email
Body:
```json
{
    "email": "vendor@example.com",
    "original": true,
    "duplicate": false,
    "transport": false,
    "office": false
}
```
Response:
```json
{
    "success": true,
    "message": "Email sent successfully"
}
```

### Share Expense via WhatsApp
`POST` /daily-expenses/:id/share-whatsapp
Body:
```json
{
    "mobile": "919876543210",
    "original": true,
    "duplicate": false,
    "transport": false,
    "office": false
}
```
Response:
```json
{
    "success": true,
    "message": "WhatsApp link generated",
    "data": {
        "link": "https://wa.me/919876543210?text=..."
    }
}
```

### Generate Public Link (Single or Multiple)
```http
GET /api/daily-expenses/:id/public-link
Authorization: Bearer <token>
```
**Parameters**
- `:id`: Expense ID OR comma-separated Expense IDs for merged PDF.
Generates a secure, shareable public link for viewing the expense without authentication.

**Response**:
```json
{
  "success": true,
  "publicLink": "http://.../api/daily-expenses/view-public/:id/:token"
}
```

### View Public PDF (Single or Multiple)
```http
GET /api/daily-expenses/view-public/:id/:token
```
**Parameters**
- `:id`: Expense ID OR comma-separated Expense IDs for merged PDF.
**No authentication required**. Validates the token and returns the expense PDF for browser viewing.

**Query Parameters (Optional)**
- `original`: Boolean (default: true)
- `duplicate`: Boolean
- `transport`: Boolean
- `office`: Boolean

**Response**: PDF binary file (Content-Type: application/pdf)

### Merged Expense PDF (Multi-Selection)
All PDF-related endpoints (`/print`, `/download-pdf`, `/share-email`, `/share-whatsapp`, `/public-link`) support generating a merged PDF for multiple expenses by passing a comma-separated list of IDs in the `:id` parameter.

**Usage Example**:
- `GET /api/daily-expenses/id1,id2,id3/download-pdf`
- `GET /api/daily-expenses/id1,id2,id3/print`
- `GET /api/daily-expenses/id1,id2,id3/public-link`

The resulting PDF will contain the selected copies (Original, Duplicate, etc.) for each expense ID sequentially.
