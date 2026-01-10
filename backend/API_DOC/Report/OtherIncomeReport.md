# Other Income Report Search

Search other incomes with advanced filters and column selection.

## URL
`POST /api/reports/other-income-report/search`

## Method
`POST`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `category` | String | No | Filter by category name (partial match). |
| `title` | String | No | Filter by income item name (searches `items.incomeName`). |
| `paymentType` | String | No | Filter by payment type (CASH, ONLINE, etc.). |
| `fromDate` | String | No | Start date (YYYY-MM-DD). |
| `toDate` | String | No | End date (YYYY-MM-DD). |
| `selectedColumns` | Array<String> | No | List of fields to include in the response (e.g., `["incomeDate", "grandTotal"]`). |
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
    "category": "Sales",
    "fromDate": "2023-01-01",
    "toDate": "2023-01-31",
    "selectedColumns": ["incomeDate", "incomeNo", "grandTotal"],
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
        "incomes": [
            {
                "_id": "64a...",
                "incomeNo": "INC-001",
                "incomeDate": "2023-01-15T00:00:00.000Z",
                "category": "Sales",
                "grandTotal": 1500,
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
