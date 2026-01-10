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
