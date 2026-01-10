**Base URL**: `http://localhost:5000/api`

## Delivery Challans

### Custom Fields
`GET` /api/delivery-challans/custom-fields
`POST` /api/delivery-challans/custom-fields
`PUT` /api/delivery-challans/custom-fields/:id
`DELETE` /api/delivery-challans/custom-fields/:id

### Item Columns
`GET` /api/delivery-challans/item-columns
`POST` /api/delivery-challans/item-columns
`PUT` /api/delivery-challans/item-columns/:id
`DELETE` /api/delivery-challans/item-columns/:id

### List (Paginated)
`GET` /api/delivery-challans
- Query Params: `page`, `limit`, `sort`, `order`.
- Returns paginated delivery challans for the user. No search/filters supported.

### Summary
`GET` /api/delivery-challans/summary
- Computes aggregated totals across all Delivery Challans for the user. No filters supported.

### Search (Advanced Filters)
`GET` /api/delivery-challans/search
- Query Params:
    - `page`, `limit`, `sort`, `order`
    - `search` (Global search in customer MS, challan no, remarks, products)
    - `showAll` (Set to `true` to disable pagination/filters)
    - `company` / `customerName`
    - `product` / `productName`
    - `productGroup`
    - `deliveryChallanNo` / `challanNumber`
    - `deliveryChallanType` (Enum: `REGULAR`, `JOB WORK`, `SKD/CKD`, `FOR OWN USE`, etc.)
    - `supplyType` (`OUTWARD`, `INWARD`)
    - `eWayBill` (`NO_EWAY_BILL`, `GENERATE_EWAY_BILL`, `CANCELLED_EWAY_BILL`)
    - `fromDate` / `toDate`
    - `minAmount` / `maxAmount`
    - `lrNo` / `documentNo`
    - `itemNote`
    - `remarks` / `documentRemarks`
    - `gstin` / `gstinPan`
    - `shipTo` / `shippingAddress`
    - `staffName`
    - `cf_<fieldId>` (Dynamic custom field filters)
    - `advanceFilter` (JSON: `{ "field": "...", "operator": "...", "value": "..." }`)

### Create (with optional Save & Print)
`POST` /api/delivery-challans
- Body: `customerInformation`, `deliveryChallanDetails`, `transportDetails`, `items`, `additionalCharges`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `print` (Boolean), `shareOnEmail` (Boolean).

### Get Single
`GET` /api/delivery-challans/:id

### Update
`PUT` /api/delivery-challans/:id

### Delete
`DELETE` /api/delivery-challans/:id

### Print PDF
`GET` /api/delivery-challans/:id/print

