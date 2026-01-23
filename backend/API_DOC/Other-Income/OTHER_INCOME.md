**Base URL**: `http://localhost:5000/api`

## Other Income Categories
`GET` /api/other-income-categories
- Supports `?search=name` filters.
- Returns merged list of master categories and categories derived from Other Income records.

`POST` /api/other-income-categories
- Body: `{ "name": "Category Name" }`

`PUT` /api/other-income-categories/:id
- Body: `{ "name": "New Name" }`

`DELETE` /api/other-income-categories/:id
- Performs soft delete. Fails if linked to existing Other Income records.

`PATCH` /api/other-income-categories/:id/toggle-status
- Toggles category status between "Active" and "Inactive".

---

## Other Incomes

### Custom Fields
`GET` /api/other-incomes/custom-fields
`POST` /api/other-incomes/custom-fields
`PUT` /api/other-incomes/custom-fields/:id
`DELETE` /api/other-incomes/custom-fields/:id
- Uses the same structure and storage as Daily Expense custom fields.

### Item Columns
`GET` /api/other-incomes/item-columns
`POST` /api/other-incomes/item-columns
`PUT` /api/other-incomes/item-columns/:id
`DELETE` /api/other-incomes/item-columns/:id
- Uses the same structure and storage as Daily Expense item columns.

### List & Search
`GET` /api/other-incomes
- Query Params: `search`, `fromDate`, `toDate`, `category`, `incomeNo`, `paymentType`, `minAmount`, `maxAmount`, `cf_<fieldId>`.

### Summary
`GET` /api/other-incomes/summary
- Same filters as List API.
- Returns `{ success: true, data: { totalTransactions, totalValue } }`.

### Create (with optional Save & Print)
`POST` /api/other-incomes
- Body Fields: `incomeNo`, `incomeDate`, `category`, `paymentType`, `remarks`, `items` (Array), `roundOff`, `amountInWords`, `customFields` (Object/Map), `print` (Boolean).

### Import
`POST` /api/other-incomes/import
- Content-Type: `multipart/form-data`
- File Field: `file`
- Excel Columns: `incomeNo`, `incomeDate`, `category`, `paymentType`, `remarks`, `incomeName`, `note`, `price`, `roundOff`, `amountInWords`, `cf_<fieldId>`.

### Download Sample Data
`GET` /api/other-incomes/import/sample
- Generates and downloads a sample Excel template for importing Other Income.
- Headers are dynamically generated based on active custom fields.

### Update & Delete
`GET` /api/other-incomes/:id
- Returns a single Other Income record by ID.

`PUT` /api/other-incomes/:id
- Body Fields: `incomeNo`, `incomeDate`, `category`, `paymentType`, `remarks`, `items` (Array), `roundOff`, `amountInWords`, `customFields` (Object/Map).
- Recalculates totals if items or roundOff are updated.

`DELETE` /api/other-incomes/:id
- Permanently deletes the Other Income record.

### PDF & Sharing
`GET` /api/other-incomes/:id/download-pdf
- Supports single ID or comma-separated IDs for merged PDF.
- Query Params: `original`, `duplicate`, `transport`, `office` (set to `true` to include).
- Returns PDF file.

`POST` /api/other-incomes/:id/share-email
- Body: `{ "email": "recipient@example.com", "original": true, ... }`
- Sends PDF as attachment.

`POST` /api/other-incomes/:id/share-whatsapp
- Body: `{ "mobile": "91XXXXXXXXXX", "original": true, ... }`
- Returns a WhatsApp web link with a message containing a public view link.

`GET` /api/other-incomes/:id/public-link
- Returns a secure, unauthenticated link to view the PDF.

`GET` /api/other-incomes/view-public/:id/:token
- Unauthenticated endpoint to view/download the PDF.
- Supports copy selection via query params.

### Print Receipt
`GET` /api/other-incomes/:id/print
- Returns basic PDF receipt (original only).



