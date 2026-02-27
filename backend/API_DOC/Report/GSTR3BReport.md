# GSTR-3B Dynamic Report API

This API retrieves dynamically aggregated GSTR-3B report data matching the exact filing structure.

## 1. Get GSTR-3B Report Data

**Endpoint:**
`POST /api/reports/gstr3b/search`

**Request Payload:**
```json
{
  "fromDate": "2026-02-01",
  "toDate": "2026-02-27"
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "section3_1": [
      {
        "desc": "(a) Outward Taxable supplies (other than zero rated, nil rated and exempted)",
        "taxable": 224406,
        "igst": 0,
        "cgst": 0,
        "sgst": 0,
        "cess": 0
      },
      ...
    ],
    "section4": {
      "A": [...],
      "B": [...],
      "C": [...],
      "D": [...]
    },
    ...
  }
}
```

## 2. Generate GSTR-3B Custom Excel File (Export / Email)

Because GSTR-3B has highly complex and specific colorful tables, it leverages the `/api/reports/action/` endpoints to automatically construct the files without needing a manual frontend generator.

**Export Excel:**
`POST /api/reports/action/export`

**Email Excel:**
`POST /api/reports/action/email`

**Request Payload for Exports:**
```json
{
  "reportType": "gstr3b",
  "reportTitle": "GSTR-3B Report",
  "filters": {
    "fromDate": "2026-02-01",
    "toDate": "2026-02-27"
  },
  "to": "test@example.com"  // (Only required if doing action/email)
}
```

**Notes:**
- When `reportType: "gstr3b"` is passed to `/export` or `/email`, the system overrides standard PDF/Excel generation.
- It will programmatically build the "Orange, Blue, Yellow, Purple, Green" table structures using `exceljs` exactly matching the GSTR-3B portal.
- It will automatically fetch the `Legal Name`, `GSTIN`, and map the dates dynamically onto the top columns.
- On email, it will attach the `.xlsx` layout instead of a PDF.
