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

### Update Note
`PATCH` /api/delivery-challans/:id/note
- Body: `note` (String)
- Returns the updated delivery challan.

### Delete
`DELETE` /api/delivery-challans/:id

### Print PDF
`GET` /api/delivery-challans/:id/print
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans)
- Note: Renders a professional blue-themed PDF.

### Download PDF (Bulk/Merged)
`GET` /api/delivery-challans/download/:id
- Path Params: `:id` can be a single ID or comma-separated IDs (e.g., `id1,id2`).
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans)
- Returns a merged PDF for multiple challans or a single PDF.

### Share via Email
`POST` /api/delivery-challans/share-email/:id
- Path Params: `:id` can be a single ID or comma-separated IDs.
- Body: `{ "email": "customer@example.com" }` (Optional, defaults to customer record).
- Success Response: `{ "success": true, "message": "Delivery Challan(s) sent to ... successfully" }`

### Share via WhatsApp
`POST` /api/delivery-challans/share-whatsapp/:id
- Path Params: `:id` can be a single ID or comma-separated IDs.
- Body: `{ "phone": "91..." }` (Optional, defaults to customer record).
- Success Response: `{ "success": true, "data": { "whatsappNumber": "...", "deepLink": "..." } }`

### Generate Public View Link
`GET` /api/delivery-challans/:id/public-link
- Path Params: `:id` can be a single ID or comma-separated IDs.
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans)
- Success Response: `{ "success": true, "publicLink": "..." }`

### View Public PDF (Unauthenticated)
`GET` /api/delivery-challans/view-public/:id/:token
- Path Params: `:id` (Single or Comma-separated), `:token` (HMAC security token)
- Note: This endpoint does not require authentication and is intended for sharing with customers.

### Generate Label / Envelope
`GET` /api/delivery-challans/:id/label?type=SHIPPING&size=Medium
- Query Params:
    - `type`: `SHIPPING` (default) or `ENVELOPE`
    - `size`: `Small`, `Medium`, `Large`
    - `action`: `download` (optional, forces download)
- Returns a PDF file.

### Convert to Sale Invoice
Convert a completed Delivery Challan into a Sale Invoice.

- **URL:** `/api/delivery-challans/:id/convert-to-sale-invoice`
- **Method:** `POST`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 201 CREATED
  - **Content:**
    ```json
    {
      "success": true,
      "message": "Converted to Sale Invoice successfully",
      "data": {
        "saleInvoiceId": "60d21b4667d0d8992e610c85",
        "invoiceNumber": "INV-001"
      }
    }
    ```
  - **Notes:**
    - Creates a new Sale Invoice.
    - Copies all customer details, items, tax, and totals.
    - Updates original Delivery Challan with conversion reference.

### Cancel Delivery Challan
Mark a Delivery Challan as canceled.

- **URL:** `/api/delivery-challans/:id/cancel`
- **Method:** `PUT`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** `{ "success": true, "message": "Delivery Challan cancelled successfully", "data": { ... } }`

### Restore Delivery Challan
Restore a cancelled Delivery Challan to COMPLETED status.

- **URL:** `/api/delivery-challans/:id/restore`
- **Method:** `PUT`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** `{ "success": true, "message": "Delivery Challan restored successfully", "data": { ... } }`

### Attachments
Manage files attached to a Delivery Challan.

#### Upload Attachment
- **URL:** `/api/delivery-challans/:id/attachments`
- **Method:** `POST`
- **Auth Required:** Yes
- **Form-Data:** `file` (File object)
- **Success Response:**
  - **Code:** 201 CREATED
  - **Content:** `{ "success": true, "message": "File attached successfully", "data": [ ...attachments ] }`

#### Get Attachments
- **URL:** `/api/delivery-challans/:id/attachments`
- **Method:** `GET`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** `{ "success": true, "data": [ { "fileName": "...", "filePath": "...", "fileSize": 123, "uploadedAt": "..." } ] }`

#### Delete Attachment
- **URL:** `/api/delivery-challans/:id/attachments/:attachmentId`
- **Method:** `DELETE`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 200 OK
  - **Content:** `{ "success": true, "message": "Attachment removed successfully", "data": [ ...remaining ] }`

### Get Data for Conversion (Sale Invoice)
Fetch Delivery Challan data mapped to Sale Invoice structure for pre-filling the create form.

- **URL:** `/api/delivery-challans/:id/convert-to-invoice`
- **Method:** `GET`
- **Auth Required:** Yes
- **Success Response:**
  - **Code:** 200 OK
  - **Content:**
    ```json
    {
      "success": true,
      "message": "Delivery Challan data for conversion retrieved",
      "data": {
        "customerInformation": { ... },
        "items": [ ... ],
        "totals": { ... },
        "conversions": {
            "convertedFrom": {
                "docType": "Delivery Challan",
                "docId": "..."
            }
        }
      }
    }
    ```
