# Day Book Report

Fetch daily transaction records (Sales, Purchase, Expenses, Incomes, Payments) based on date and filters.

## URL
`POST /api/reports/day-book/`

## Method
`POST`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `date` | String | No | Specific date (YYYY-MM-DD). If provided, overrides fromDate/toDate. |
| `fromDate` | String | No | Start date (YYYY-MM-DD). |
| `toDate` | String | No | End date (YYYY-MM-DD). |
| `customerVendor` | String | No | Filter by Customer/Vendor Name (or Company Name). |
| `staffId` | String | No | Filter by Staff ID (applies mainly to expenses). |
| `showAllDocuments` | Boolean | No | If `true`, returns all records for the date ignoring customer/staff filters. |
| `groupByCustomer` | Boolean | No | If `true`, groups results by Customer/Vendor Name. |
| `groupByVoucherType` | Boolean | No | If `true`, groups results by Voucher Type (e.g., Sale Invoice). |

### Example Request
```json
{
    "fromDate": "2023-01-01",
    "toDate": "2023-01-01",
    "customerVendor": "John",
    "showAllDocuments": false,
    "groupByCustomer": false,
    "groupByVoucherType": true
}
```

## Success Response

**Code**: `200 OK`

### Standard (No Grouping)
```json
{
    "success": true,
    "data": [
        {
            "date": "2023-01-01T10:00:00.000Z",
            "voucherType": "Sale Invoice",
            "voucherNo": "INV-001",
            "partyName": "John Doe",
            "amount": 5000,
            "paymentType": "CASH",
            "type": "Credit",
            "_id": "64a..."
        },
        ...
    ],
    "summary": {
        "totalCredit": 10000,
        "totalDebit": 2000,
        "netBalance": 8000
    }
}
```

### Grouped by Voucher Type
```json
{
    "success": true,
    "data": [
        {
            "voucherType": "Sale Invoice",
            "totalAmount": 5000,
            "records": [...]
        },
        {
            "voucherType": "Daily Expense",
            "totalAmount": 1000,
            "records": [...]
        }
    ],
    "summary": { ... }
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
