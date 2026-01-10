**Base URL**: `http://localhost:5000/api`

## Go Drive

### Search Documents
```http
GET /api/go-drive/search
Authorization: Bearer <token>
```
**Query Params**: `referenceType` (product/purchase_invoice/daily_expense/letter), `fromDate`, `toDate`, `searchAll`

