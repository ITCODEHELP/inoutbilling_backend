# GSTR-1 Report Search

The GSTR-1 Report Search API provides data for various sections of the GSTR-1 return.

## URL
`POST /api/reports/gstr1/search`

## Method
`POST`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body

| Field | Type | Required | Description |
|---|---|---|---|
| `fromDate` | String | Yes | Start date (YYYY-MM-DD). |
| `toDate` | String | Yes | End date (YYYY-MM-DD). |
| `section` | String | Yes | GSTR-1 Section (see below). |

### Allowed Sections
| Section | Description | Data Source |
|---|---|---|
| `B2B` | B2B Invoices | SaleInvoice (with GSTIN) |
| `B2CL` | B2C Large Invoices | SaleInvoice (no GSTIN, >2.5L, Inter-state) |
| `B2CS` | B2C Small Invoices | SaleInvoice (no GSTIN, Small/Intra-state) |
| `CDNR` | Registered Credit/Debit Notes | CreditNote / DebitNote (with GSTIN) |
| `CDNUR` | Unregistered Credit/Debit Notes | CreditNote / DebitNote (no GSTIN) |
| `EXP` | Export Invoices | ExportInvoice |
| `HSN_B2B` / `HSN_B2C` | HSN-wise Summary | SaleInvoice (grouped by HSN) |
| `DOCS` | Document Summary | SaleInvoice (sequence summary) |
| `AT` | Advance Tax | Placeholder |
| `ATADJ` | Advance Tax Adjustment | Placeholder |
| `EXEMP` | Exempted Supplies | Placeholder |

### Example Request
```json
{
    "fromDate": "2023-01-01",
    "toDate": "2023-01-31",
    "section": "B2B"
}
```

## Success Response

**Code**: `200 OK`

**Content**:
```json
{
    "success": true,
    "section": "B2B",
    "count": 5,
    "data": [
        {
            "gstin": "07AAAAA0000A1Z5",
            "customerName": "Acme Corp",
            "invoiceNo": "INV-001",
            "date": "2023-01-10T00:00:00.000Z",
            "invoiceValue": 10000,
            "placeOfSupply": "Delhi",
            "reverseCharge": false,
            "invoiceType": "Regular",
            "taxableValue": 8474.58,
            "igst": 1525.42,
            "cgst": 0,
            "sgst": 0,
            "taxAmount": 1525.42
        },
        ...
    ]
}
```

## Error Response

**Code**: `400 Bad Request` (Missing fields)
**Code**: `404 Not Found` (User not found)
**Code**: `500 Internal Server Error` (Database issues)

---

# GSTR-1 Report Actions (Export & Email)

GSTR-1 data can be exported to Excel or Emailed directly using the shared dynamic `ReportAction` endpoints. This supports both standard (date range) and **Quarterly** exports.

## URLs

- **Export Excel:** `POST /api/reports/action/export`
- **Email Report:** `POST /api/reports/action/email`

## Headers
- `Authorization`: `Bearer <token>` (Required)
- `Content-Type`: `application/json`

## Request Body Structure

When using the `ReportAction` endpoints for GSTR-1, you must pass `"reportType": "gstr1"`. The GSTR-1 specific parameters (like `section` and `isQuarterly`) must be provided inside the `filters` object.

### Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `reportType` | String | Yes | Must be exactly `"gstr1"`. |
| `filters` | Object | Yes | Contains the parameters for data fetching. |
| `filters.fromDate` | String | Yes | Start date (YYYY-MM-DD). |
| `filters.toDate` | String | Yes | End date (YYYY-MM-DD). |
| `filters.section` | String | Yes | GSTR-1 Section (e.g., `"B2CL"`, `"EXP"`, etc.). |
| `filters.isQuarterly`| Boolean| No | If `true`, the `fromDate` to `toDate` range is divided into 3-month blocks and all data is aggregated. |
| `reportTitle` | String | No | Title of the exported/emailed file. |
| `to` | String | *Email only* | Recipient email address. |

### Example Request (Standard Export)
```json
{
  "reportType": "gstr1",
  "reportTitle": "GSTR-1 B2CL April 2025",
  "filters": {
    "section": "B2CL",
    "fromDate": "2021-04-01",
    "toDate": "2026-04-30"
  }
}
```

### Example Request (Quarterly Export / Email)
```json
{
  "reportType": "gstr1",
  "reportTitle": "GSTR-1 CDNR Quarterly FY25-26",
  "to": "accountant@example.com",
  "subject": "Quarterly GSTR-1 Data",
  "filters": {
    "section": "CDNR",
    "fromDate": "2025-04-01",
    "toDate": "2026-03-31",
    "isQuarterly": true
  }
}
```

## Testing Data for Quarterly Export

To test the quarterly logic, you can use the following payload against the `POST /api/reports/action/export` route. 

It is designed to fetch an entire financial year and verify that the backend successfully chunks it and maps the dynamic columns for the selected section.

**Testing Payload 1: B2B Quarterly**
```json
{
  "reportType": "gstr1",
  "reportTitle": "TEST - B2B Quarterly Results",
  "filters": {
    "section": "B2B",
    "fromDate": "2025-04-01",
    "toDate": "2026-03-31",
    "isQuarterly": true
  }
}
```

**Testing Payload Quarterly**
```json
{
  "reportType": "gstr1",
  "reportTitle": "TEST - HSN B2B Quarterly Results",
  "filters": {
    "section": "HSN_B2B",
    "fromDate": "2025-04-01",
    "toDate": "2026-03-31",
    "isQuarterly": true
  }
}
```

## Response

- **Export (`/export`)**: Triggers an attachment download prompt (returns `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- **Email (`/email`)**: Returns a standard JSON success message:
  ```json
  {
      "success": true,
      "message": "Email sent successfully"
  }
  ```
