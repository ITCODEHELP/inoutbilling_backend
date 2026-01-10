**Base URL**: `http://localhost:5000/api`

## Sale Orders

### Custom Fields
`GET` /api/sale-orders/custom-fields
`POST` /api/sale-orders/custom-fields
`PUT` /api/sale-orders/custom-fields/:id
`DELETE` /api/sale-orders/custom-fields/:id

### Item Columns
`GET` /api/sale-orders/item-columns
`POST` /api/sale-orders/item-columns
`PUT` /api/sale-orders/item-columns/:id
`DELETE` /api/sale-orders/item-columns/:id

### List (Paginated)
`GET` /api/sale-orders
- Query Params: `page`, `limit`, `sort`, `order`

### Search (Advanced)
`GET` /api/sale-orders/search
- Query Params:
    - `page`, `limit`, `sort`, `order`
    - `search` (Global search in customer information, SO number, remarks, products)
    - `showAll` (`true` to disable pagination/filters)
    - `company` / `customerName`
    - `product` / `productName`
    - `productGroup`
    - `soNo` / `soNumber`
    - `saleOrderType` (Enum: `REGULAR`, `BILL_OF_SUPPLY`, `SEZ/EXPORT with IGST`, `SEZ/EXPORT without IGST`)
    - `status` (Enum: `NEW`, `PENDING`, `IN_WORK`, `COMPLETED`)
    - `fromDate` / `toDate`
    - `minAmount` / `maxAmount`
    - `lrNo` / `documentNo`
    - `itemNote`
    - `remarks` / `documentRemarks`
    - `gstin` / `gstinPan`
    - `shipTo` / `shippingAddress`
    - `staffName`
    - `cf_<fieldName>` (Custom field filters)
    - `advanceFilter` (JSON: `{ "field": "...", "operator": "...", "value": "..." }`)

### Summary
`GET` /api/sale-orders/summary
- Supports same filters as search.

### Single SO Detail
`GET` /api/sale-orders/:id

### Create
`POST` /api/sale-orders
- Body: `customerInformation`, `saleOrderDetails`, `transportDetails`, `items`, `additionalCharges`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `staff`.

### Update
`PUT` /api/sale-orders/:id

### Delete
`DELETE` /api/sale-orders/:id

