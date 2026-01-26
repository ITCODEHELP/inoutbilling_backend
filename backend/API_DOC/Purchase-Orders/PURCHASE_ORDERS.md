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

### Update Status
`PATCH` /api/purchase-orders/:id/status
- Body: `{ "status": "New" | "Pending" | "In-Work" | "Completed" }`

### Delete
`DELETE` /api/purchase-orders/:id

### Remaining Quantity
`GET` /api/purchase-orders/:id/remaining-quantity
- Description: Returns per-item remaining quantity (used / total) based on linked transactions.
- Response:
    ```json
    {
        "success": true,
        "count": 1,
        "data": [
            {
                "productName": "Product A",
                "usedQty": 1,
                "totalQty": 3,
                "remainingQty": 2,
                "displayFormat": "1/3"
            }
        ]
    }
    ```
- Note: Returns `data: null` if all items are fully consumed (remaining quantity is zero).

### Envelope / Shipping Label
`GET` /api/purchase-orders/:id/label
- Query Params:
    - `type` (`SHIPPING` | `ENVELOPE`) - Default: `SHIPPING`
    - `size` (`Small` | `Medium` | `Large`) - Default: `Medium`
    - `action` (`download` | `print` | `view`) - If `download`, returns as attachment; else returns inline for browsing/printing.
- Description: Generates a printable PDF label or envelope for the Purchase Order.

### Convert to Purchase Invoice
`GET` /api/purchase-orders/:id/convert-to-purchase-invoice
- Description: Returns pre-filled data for the Purchase Invoice form based on the Purchase Order.

### Convert to Delivery Challan
`GET` /api/purchase-orders/:id/convert-to-challan
- Description: Returns pre-filled data for the Delivery Challan form based on the Purchase Order.

### Duplicate
`GET` /api/purchase-orders/:id/duplicate
- Description: Returns cleaned Purchase Order data (excluding ID, document number, status, etc.) for pre-filling a new Purchase Order form.

### Cancel Purchase Order
`POST` /api/purchase-orders/:id/cancel
- Description: Marks a Purchase Order as Cancelled.

### Restore Purchase Order
`POST` /api/purchase-orders/:id/restore
- Description: Restores a Cancelled Purchase Order back to New status.

## Attachment APIs

### Attach Files
`POST` /api/purchase-orders/:id/attach-file
- Uploads multiple files (up to 10) to a purchase order.
- **Form Data**: `attachments` (file array)

### Get Attachments
`GET` /api/purchase-orders/:id/attachments
- Retrieves all attachments linked to a purchase order.

### Update (Replace) Attachment
`PUT` /api/purchase-orders/:id/attachment/:attachmentId
- Replaces an existing attachment while preserving its reference order.
- **Form Data**: `attachment` (single file)

### Delete Attachment
`DELETE` /api/purchase-orders/:id/attachment/:attachmentId
- Permanently deletes an attachment from the database and disk.

## PDF & Sharing APIs

### Print Purchase Order
`GET` /api/purchase-orders/:id/print
- Description: Renders and opens the Purchase Order PDF for printing in the browser.
- Uses the Delivery Challan template.

### Download PDF
`GET` /api/purchase-orders/:id/download-pdf
- Description: Downloads single or merged Purchase Order(s) as a PDF.
- Query Params: `original`, `duplicate`, `transport`, `office` (boolean)

### Share via Email
`POST` /api/purchase-orders/:id/share-email
- Description: Sends the Purchase Order PDF to an email address.
- Body: `email` (optional)
- Query Params: same as Download PDF.

### Share via WhatsApp
`POST` /api/purchase-orders/:id/share-whatsapp
- Description: Generates a WhatsApp share link for the Purchase Order.
- Body: `phone` (optional)
- Query Params: same as Download PDF.
- Returns: `{ whatsappNumber, deepLink }`

### Public Link
`GET` /api/purchase-orders/:id/public-link
- Description: Generates a secure public URL for viewing the Purchase Order.
- Returns: `{ publicLink }`

### Public View PDF (Unprotected)
`GET` /api/purchase-orders/view-public/:id/:token
- Description: Publicly accessible endpoint to view the Purchase Order PDF.


