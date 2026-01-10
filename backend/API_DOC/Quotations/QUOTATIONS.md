**Base URL**: `http://localhost:5000/api`

## Quotations

### Custom Fields
`GET` /api/quotations/custom-fields
`POST` /api/quotations/custom-fields
`PUT` /api/quotations/custom-fields/:id
`DELETE` /api/quotations/custom-fields/:id

### Item Columns
`GET` /api/quotations/item-columns
`POST` /api/quotations/item-columns
`PUT` /api/quotations/item-columns/:id
`DELETE` /api/quotations/item-columns/:id

### List & Search
`GET` /api/quotations
- Supports Query Params:
  - `search`: Global search (Customer, No, Remarks, Product)
  - `showAll`: "true" to ignore filters
  - `company`: Search by customer name (M/S)
  - `product`: Search by product name
  - `productGroup`: Search by product group
  - `fromDate`, `toDate`: Date range for quotation date
  - `staffName`: Search by staff full name
  - `quotationNo`: Search by quotation number
  - `minAmount`, `maxAmount`: Search by grand total range
  - `lrNo`: Search by transport document number
  - `itemNote`: Search by item-level notes
  - `remarks`: Search by document remarks
  - `gstin`: Search by customer GSTIN/PAN
  - `quotationType`: Filter by type (Regular, Bill of Supply, etc.)
  - `shipTo`: Search by shipping address
  - `advanceFilter`: JSON object `{ "field": "Field Name", "operator": "operator", "value": "value" }`
  - `cf_<fieldId>`: Dynamic custom field filters.

### Summary Data
`GET` /api/quotations/summary
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
`POST` /api/quotations
- Body: `customerInformation`, `quotationDetails`, `transportDetails`, `items`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `print` (Boolean).

### Get Single
`GET` /api/quotations/:id

### Update
`PUT` /api/quotations/:id

### Delete
`DELETE` /api/quotations/:id

### Print PDF
`GET` /api/quotations/:id/print

