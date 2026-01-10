**Base URL**: `http://localhost:5000/api`

## Job Work

### List
`GET` /api/job-work
- Query Params: `page`, `limit`, `sort`, `order`, `search`, `status`, `fromDate`, `toDate`, `jobWorkNumber`, `company`.

### Summary
`GET` /api/job-work/summary
- Supports same filters as List (`search`, `status`, `fromDate`, `toDate`, `jobWorkNumber`, `company`).
- Returns: `totalTransactions`, `totalTaxable`, `totalCGST`, `totalSGST`, `totalIGST`, `totalValue`.

### Search (Advanced)
`GET` /api/job-work/search
- Query Params:
    - `page`, `limit`, `sort`, `order`
    - `search` (Keyword search)
    - `company` / `customerName`
    - `product` / `productName`
    - `productGroup`
    - `fromDate` / `toDate`
    - `staffName`
    - `jobWorkNumber`
    - `total`
    - `lrNo`
    - `itemNote`
    - `remarks`
    - `gstin`
    - `status` (new, pending, in-work, completed)
    - `jobWorkType`
    - `shippingAddress`
    - `advanceFilters` (JSON Array: `[{ "field": "...", "operator": "...", "value": "..." }]`)

### Single Detail
`GET` /api/job-work/:id

### Create
`POST` /api/job-work
- Body: `customerInformation`, `jobWorkDetails`, `shippingAddress`, `useSameShippingAddress`, `items`, `additionalCharges`, `totals`, `staff`, `branch`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `shareOnEmail`, `customFields`.

### Update
`PUT` /api/job-work/:id

### Delete
`DELETE` /api/job-work/:id

