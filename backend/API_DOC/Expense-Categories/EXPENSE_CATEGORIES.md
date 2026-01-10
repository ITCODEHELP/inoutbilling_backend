**Base URL**: `http://localhost:5000/api`

## Expense Categories
`GET` /api/expense-categories
- Supports `?search=name` filter.

### Response
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "677b63fbd55e8d53066986e8",
      "name": "Fuel",
      "status": "Active"
    },
    {
      "_id": "677b63fbd55e8d53066986e9",
      "name": "Refreshments",
      "status": "Active"
    }
  ]
}
```

`POST` /api/expense-categories
- Body: `{ "name": "Category Name" }`

`PUT` /api/expense-categories/:id
- Body: `{ "name": "New Name" }`

`DELETE` /api/expense-categories/:id

