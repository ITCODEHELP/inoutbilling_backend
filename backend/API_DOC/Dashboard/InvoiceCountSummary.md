# Invoice Count Summary API

Returns total counts for various document types (Sale Invoices, Purchase Invoices, Daily Expenses, Other Incomes).

## Endpoint
`GET /api/dashboard/invoice-summary/counts`

## Authentication
Required (JWT)

## Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromDate | Date | No | Start date for filtering (ISO format) |
| toDate | Date | No | End date for filtering (ISO format) |
| branchId | String | No | Filter by branch (ObjectId) |

## Response Structure
```json
{
  "success": true,
  "data": {
    "saleCount": 150,
    "purchaseCount": 45,
    "expenseCount": 82,
    "incomeCount": 12
  }
}
```

## Performance Notes
- Uses concurrent database calls (`Promise.all`) for minimum latency.
- Leverages indexed `userId` and date fields.
