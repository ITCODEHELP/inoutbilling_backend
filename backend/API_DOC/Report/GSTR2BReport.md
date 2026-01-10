# GSTR-2B Reconciliation Report

Reconcile GSTR-2B JSON data with Purchase Invoices in the database.

## 1. Upload & Reconcile
`POST /api/reports/gstr2b/upload`

### Headers
- `Authorization`: `Bearer <token>`
- `Content-Type`: `multipart/form-data`

### Body (Multipart form-data)
- `gstr2bFile`: The JSON file downloaded from the GST Portal.
- `fromDate`: (Optional) Start date for purchase records (YYYY-MM-DD).
- `toDate`: (Optional) End date for purchase records (YYYY-MM-DD).

### Success Response
**Code**: `200 OK`
```json
{
    "success": true,
    "data": [
        {
            "status": "Exact Matched",
            "purchase": { ...purchaseInvoiceRecord... },
            "gstr2b": { ...jsonInvoiceData... }
        },
        {
            "status": "Partially Matched",
            "purchase": { ... },
            "gstr2b": { ... },
            "differences": { "taxable": true, "date": false }
        },
        {
            "status": "Missing in Purchase",
            "purchase": null,
            "gstr2b": { ... }
        },
        {
            "status": "Missing in 2B",
            "purchase": { ... },
            "gstr2b": null
        }
    ],
    "summary": {
        "exactMatched": 10,
        "partiallyMatched": 2,
        "missingInPurchase": 5,
        "missingIn2B": 3,
        "totalRecords": 20
    }
}
```

## 2. Filter Results (Tab Clicks)
`POST /api/reports/gstr2b/filter`

Used to filter the data by status for the different UI tabs.

### Headers
- `Authorization`: `Bearer <token>`
- `Content-Type`: `application/json`

### Body
```json
{
    "results": [...aggregatedDataFromUploadAPI...],
    "status": "Exact Matched"
}
```
*Note: `status` can be "Exact Matched", "Partially Matched", "Missing in Purchase", "Missing in 2B", or "All".*

### Success Response
**Code**: `200 OK`
```json
{
    "success": true,
    "count": 10,
    "data": [...]
}
```
