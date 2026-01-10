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

