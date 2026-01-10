**Base URL**: `http://localhost:5000/api`

## Other Income Categories
`GET` /api/other-income-categories
- Supports `?search=name&page=1&limit=10&sort=name&order=asc` filters.

`POST` /api/other-income-categories
- Body: `{ "name": "Category Name" }`

`PUT` /api/other-income-categories/:id
- Body: `{ "name": "New Name", "status": "Active|Inactive" }`

`DELETE` /api/other-income-categories/:id

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

### Print Receipt
`GET` /api/other-incomes/:id/print
- Returns PDF.

