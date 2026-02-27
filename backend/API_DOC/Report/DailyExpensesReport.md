# Daily Expenses Report Search

Search daily expenses with advanced filters and column selection.

## URL
`POST /api/reports/daily-expenses-report/`

## Method
`POST`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `staffName` | String | No | Filter by staff name (uses lookup on Staff collection). |
| `category` | String | No | Filter by category name (partial match). |
| `title` | String | No | Filter by expense item name (searches `items.name`). |
| `paymentType` | String | No | Filter by payment type (CASH, ONLINE, etc.). |
| `fromDate` | String | No | Start date (YYYY-MM-DD). |
| `toDate` | String | No | End date (YYYY-MM-DD). |
| `selectedColumns` | Array<String> | No | List of fields to include in the response (e.g., `["expenseDate", "grandTotal"]`). |
| `advancedFilters` | Array<Object> | No | Array of advanced filter objects `{ field, operator, value }`. |

### Advanced Filter Object
| Field | Type | Description |
|---|---|---|
| `field` | String | Database field name (e.g., `grandTotal`). |
| `operator` | String | Operator: `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterThanOrEqual`, `lessThanOrEqual`, `contains`. |
| `value` | Any | Value to compare against. |

### Example Request
```json
{
    "staffName": "John",
    "category": "Travel",
    "fromDate": "2021-01-01",
    "toDate": "2026-02-26",
    "selectedColumns": ["expenseDate", "expenseNo", "grandTotal", "staffName"],
    "advancedFilters": [
        {
            "field": "grandTotal",
            "operator": "greaterThan",
            "value": 1000
        }
    ]
}
```

## Success Response

**Code**: `200 OK`

**Content**:
```json
{
    "success": true,
    "data": {
        "expenses": [
            {
                "_id": "64a...",
                "expenseNo": "EXP-001",
                "expenseDate": "2023-01-15T00:00:00.000Z",
                "category": "Travel",
                "grandTotal": 1500,
                "staffName": "John Doe",
                ...
            },
            ...
        ],
        "pagination": {
            "total": 10,
            "page": 1,
            "limit": 10,
            "totalPages": 1
        }
    }
}
```

## Error Response

**Code**: `500 Internal Server Error`

**Content**:
```json
{
    "success": false,
    "message": "Internal Server Error",
    "error": "Error details..."
}
```

---

## Report Actions (Print, PDF, Excel, Email)

You can generate Print Views, PDFs, Excel files, or Email this report using the **Report Action Engine**.

### Endpoints
- **Print (HTML)**: `POST /api/reports/action/print`
- **PDF (Download)**: `POST /api/reports/action/pdf`
- **Excel (Download)**: `POST /api/reports/action/excel`
- **Email (Send PDF)**: `POST /api/reports/action/email`

### Request Body
Use the following payload for all the above endpoints.  
**Note**: `reportType` must be set to `daily-expenses`.

```json
{
  "reportType": "daily-expenses", 

  "filters": {
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50
  },

  "reportTitle": "Daily Expenses Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
