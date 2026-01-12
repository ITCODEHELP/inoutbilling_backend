# Expense & Income API

Returns total expenses, total other income, and net profit/loss.

## Endpoint
`GET /api/dashboard/expense-income`

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
    "totalExpense": 12500.00,
    "totalIncome": 5000.00,
    "netProfitLoss": -7500.00
  }
}
```

## Performance Notes
- Aggregates `DailyExpense` and `OtherIncome` collections concurrently.
