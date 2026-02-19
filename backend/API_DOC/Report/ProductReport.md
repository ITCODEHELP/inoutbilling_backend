# Product Report Search

Search products with advanced filters using existing Product table.

## URL
`POST /api/reports/product-report/search`

## Method
`POST`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `productName` | String | No | Filter by product name (partial match). |
| `productGroup` | String | No | Filter by product group (partial match). |
| `fromDate` | String | No | Start date for creation date range filter (YYYY-MM-DD). |
| `toDate` | String | No | End date for creation date range filter (YYYY-MM-DD). |
| `showStockAdjustedOnly` | Boolean | No | If `true`, only returns products with `manageStock` enabled. |
| `groupRecordByProduct` | Boolean | No | If `true`, sorts results by Product Name. Default sorts by Created Date descending. |

### Example Request
```json
{
    "productName": "Laptop",
    "productGroup": "Electronics",
    "fromDate": "2023-01-01",
    "toDate": "2023-12-31",
    "showStockAdjustedOnly": true,
    "groupRecordByProduct": true
}
```

## Success Response

**Code**: `200 OK`

**Content**:
```json
{
    "success": true,
    "data": {
        "products": [
            {
                "_id": "6741b...",
                "userId": "673f0...",
                "itemType": "Product",
                "name": "Dell Laptop",
                "productGroup": "Electronics",
                "manageStock": true,
                "qty": 10,
                "createdAt": "2023-06-15T10:00:00.000Z",
                ...
            },
            ...
        ],
        "pagination": {
            "total": 50,
            "page": 1,
            "limit": 10,
            "totalPages": 5
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
**Note**: `reportType` must be set to `product`.

```json
{
  "reportType": "product", 

  "filters": {
    "productGroup": "",
    "fromDate": "2026-01-01",
    "toDate": "2026-12-31"
  },
  "options": {
    "page": 1,
    "limit": 50
  },

  "reportTitle": "Product Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
