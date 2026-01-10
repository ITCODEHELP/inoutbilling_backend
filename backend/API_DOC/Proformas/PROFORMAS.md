**Base URL**: `http://localhost:5000/api`

## Proformas

### Custom Fields
`GET` /api/proformas/custom-fields
`POST` /api/proformas/custom-fields
`PUT` /api/proformas/custom-fields/:id
`DELETE` /api/proformas/custom-fields/:id

### Item Columns
`GET` /api/proformas/item-columns
`POST` /api/proformas/item-columns
`PUT` /api/proformas/item-columns/:id
`DELETE` /api/proformas/item-columns/:id

### List & Search
`GET` /api/proformas
- Supports Query Params:
  - `search`: Global search (Customer, No, Remarks, Product)
  - `showAll`: "true" to ignore filters
  - `company`: Search by customer name (M/S)
  - `product`: Search by product name
  - `productGroup`: Search by product group
  - `fromDate`, `toDate`: Date range for proforma date
  - `staffName`: Search by staff full name
  - `proformaNo`: Search by proforma number
  - `minAmount`, `maxAmount`: Search by grand total range
  - `lrNo`: Search by transport document number
  - `itemNote`: Search by item-level notes
  - `remarks`: Search by document remarks
  - `gstin`: Search by customer GSTIN/PAN
  - `proformaType`: Filter by type (Regular, Bill of Supply, etc.)
  - `shipTo`: Search by shipping address
  - `advanceFilter`: JSON object `{ "field": "Field Name", "operator": "operator", "value": "value" }`
  - `cf_<fieldId>`: Dynamic custom field filters.

### Summary Data
`GET` /api/proformas/summary
- Supports the same query filters as List & Search (company, product, fromDate, etc.).
- Returns:
  ```json
  {
    "success": true,
    "data": {
      "totalTransactions": 0,
      "totalCGST": 0,
      "totalSGST": 0,
      "totalIGST": 0,
      "totalTaxable": 0,
      "totalValue": 0
    }
  }
  ```

### Create (with optional Save & Print)
`POST` /api/proformas
- Body: `customerInformation`, `proformaDetails`, `transportDetails`, `items`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `print` (Boolean).

### Get Single
`GET` /api/proformas/:id

### Update
`PUT` /api/proformas/:id

### Delete
`DELETE` /api/proformas/:id

### Print PDF
`GET` /api/proformas/:id/print

