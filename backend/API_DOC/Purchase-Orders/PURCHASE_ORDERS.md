**Base URL**: `http://localhost:5000/api`

## Purchase Orders

### Custom Fields
`GET` /api/purchase-orders/custom-fields
`POST` /api/purchase-orders/custom-fields
`PUT` /api/purchase-orders/custom-fields/:id
`DELETE` /api/purchase-orders/custom-fields/:id

### Item Columns
`GET` /api/purchase-orders/item-columns
`POST` /api/purchase-orders/item-columns
`PUT` /api/purchase-orders/item-columns/:id
`DELETE` /api/purchase-orders/item-columns/:id

### List (Paginated)
`GET` /api/purchase-orders
- Query Params: `page`, `limit`, `sort`, `order`

### Search (Advanced)
`GET` /api/purchase-orders/search
- Query Params:
    - `page`, `limit`, `sort`, `order`
    - `search` (Global search in vendor information, PO number, remarks, etc.)
    - `showAll` (`true` to disable pagination/filters)
    - `company` / `vendorName`
    - `product` / `productName`
    - `poNo` / `poNumber`
    - `fromDate` / `toDate`
    - `minAmount` / `maxAmount`
    - `deliveryMode` (`HAND DELIVERY`, `RAIL`, `AIR`, etc.)
    - `staffName`
    - `cf_<fieldName>` (Custom field filters)
    - `advanceFilter` (JSON: `{ "field": "...", "operator": "...", "value": "..." }`)

### Summary
`GET` /api/purchase-orders/summary

### Single PO Detail
`GET` /api/purchase-orders/:id

### Create
`POST` /api/purchase-orders
- Body: `vendorInformation`, `purchaseOrderDetails`, `transportDetails`, `items`, `additionalCharges`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `staff`.

### Update
`PUT` /api/purchase-orders/:id

### Delete
`DELETE` /api/purchase-orders/:id

