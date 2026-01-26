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
    - `status` (Enum: `New`, `Pending`, `In-Work`, `Completed`)
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

### Update Status
`PATCH` /api/sale-orders/:id/status
- Body: `{ "status": "New" | "Pending" | "In-Work" | "Completed" }`

### Remaining Quantity
`GET` /api/sale-orders/:id/remaining-quantity
- Description: Returns remaining quantities for SO items based on linked Sales Invoices and Delivery Challans.
- Returns `data: null` if all items are fully consumed.

### Convert to Delivery Challan
`GET` /api/sale-orders/:id/convert-to-challan
- Description: Returns pre-filled data for the Delivery Challan form based on the Sale Order.

### Convert to Sale Invoice
`GET` /api/sale-orders/:id/convert-to-invoice
- Description: Returns pre-filled data for the Sale Invoice form based on the Sale Order.
- Includes conversion reference for automatic linking.

### Convert to Proforma Invoice
`GET` /api/sale-orders/:id/convert-to-proforma
- Description: Returns pre-filled data for the Proforma Invoice form based on the Sale Order.
- Includes conversion reference for automatic linking.

### Convert to Purchase Order
`GET` /api/sale-orders/:id/convert-to-purchase-order
- Description: Returns pre-filled data for the Purchase Order form based on the Sale Order.
- Maps customer information to vendor information.
- Includes conversion reference for automatic linking.

### Duplicate
`GET` /api/sale-orders/:id/duplicate
- Description: Returns cleaned Sale Order data for duplicating/creating a new Sale Order.
- Excludes system fields, document number, status, and references.

### Cancel
`POST` /api/sale-orders/:id/cancel
- Description: Marks a Sale Order as Cancelled.
- Validates that the Sale Order is not already cancelled.

### Restore
`POST` /api/sale-orders/:id/restore
- Description: Restores a cancelled Sale Order back to New status.
- Validates that the Sale Order is in Cancelled state.

### Attach Files
`POST` /api/sale-orders/:id/attach-file
- Description: Upload up to 10 files to attach to a Sale Order.
- Content-Type: multipart/form-data
- Field name: attachments (array)

### Get Attachments
`GET` /api/sale-orders/:id/attachments
- Description: Retrieve all attachments linked to a Sale Order.

### Update Attachment
`PUT` /api/sale-orders/:id/attachment/:attachmentId
- Description: Replace an existing attachment while preserving reference order.
- Content-Type: multipart/form-data
- Field name: attachment (single)

### Delete Attachment
`DELETE` /api/sale-orders/:id/attachment/:attachmentId
- Description: Permanently remove an attachment from storage and database.

### Delete
`DELETE` /api/sale-orders/:id

## PDF & Sharing APIs

### Print Sale Order
`GET` /api/sale-orders/:id/print
- Description: Renders and opens the Sale Order PDF for printing in the browser.
- Uses the Sale Invoice template.
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean)

### Download PDF
`GET` /api/sale-orders/:id/download-pdf
- Description: Downloads single or merged Sale Order(s) as a PDF.
- `id` can be a single ID or a comma-separated list of IDs for merged PDFs.
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean)
- Response: PDF File attachment

### Share via Email
`POST` /api/sale-orders/:id/share-email
- Description: Sends the Sale Order PDF to an email address.
- `id` can be a single ID or comma-separated list.
- Body: `email` (optional, defaults to customer email)
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean)
- Response: Success message

### Share via WhatsApp
`POST` /api/sale-orders/:id/share-whatsapp
- Description: Generates a WhatsApp share link for the Sale Order.
- `id` can be a single ID or comma-separated list.
- Body: `phone` (optional, defaults to customer phone)
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean)
- Returns: `{ success: true, message: "WhatsApp share link generated", data: { whatsappNumber, deepLink } }`

### Public Link
`GET` /api/sale-orders/:id/public-link
- Description: Generates a secure public URL for viewing the Sale Order PDF.
- `id` can be a single ID or a comma-separated list of IDs for merged PDFs.
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean) - determines which copies are included in the generated link.
- Returns: `{ success: true, publicLink }`

### Public View PDF (Unprotected)
`GET` /api/sale-orders/view-public/:id/:token
- Description: Publicly accessible endpoint to view the Sale Order PDF without authentication.
- Renders the Sale Order PDF if the token is valid.
- This endpoint is publicly accessible and does not require authentication.
