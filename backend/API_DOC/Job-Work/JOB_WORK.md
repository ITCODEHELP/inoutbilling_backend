**Base URL**: `http://localhost:5000/api`

## Job Works

### Search (Advanced)
`GET` /api/job-works/search
- Query Params:
    - `page`, `limit`, `sort`, `order`
    - `search` (Global search in customer information, Job Work number, remarks, products)
    - `showAll` (`true` to disable pagination/filters)
    - `company` / `customerName`
    - `product` / `productName`
    - `productGroup`
    - `jobWorkNumber`
    - `status` (Enum: `New`, `Pending`, `In-Work`, `Completed`)
    - `fromDate` / `toDate`
    - `total`
    - `lrNo` (Mapped to custom field `lr_no`)
    - `itemNote`
    - `remarks`
    - `gstin`
    - `shippingAddress`
    - `staffName`
    - `cf_<fieldName>` (Custom field filters)
    - `advanceFilters` (JSON Array: `[{ "field": "...", "operator": "...", "value": "..." }]`)

### Summary
`GET` /api/job-works/summary
- Supports same filters as search.

### List (Paginated)
`GET` /api/job-works
- Query Params: `page`, `limit`, `sort`, `order`

### Single Job Work Detail
`GET` /api/job-works/:id

### Create
`POST` /api/job-works
- Body: `customerInformation`, `jobWorkDetails`, `shippingAddress`, `useSameShippingAddress`, `items`, `additionalCharges`, `branch`, `staff`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `shareOnEmail`, `customFields`.

### Update
`PUT` /api/job-works/:id

### Update Status
`PATCH` /api/job-works/:id/status
- Body: `{ "status": "New" | "Pending" | "In-Work" | "Completed" }`

### Remaining Quantity
`GET` /api/job-works/:id/remaining-quantity
- Description: Returns remaining quantities for Job Work items based on linked Sales Invoices and Delivery Challans.
- Returns `data: null` if all items are fully consumed.

### Convert to Delivery Challan
`GET` /api/job-works/:id/convert-to-challan
- Description: Returns pre-filled data for the Delivery Challan form based on the Job Work.

### Convert to Sale Invoice
`GET` /api/job-works/:id/convert-to-invoice
- Description: Returns pre-filled data for the Sale Invoice form based on the Job Work.
- Includes conversion reference for automatic linking.

### Convert to Sale Order
`GET` /api/job-works/:id/convert-to-sale-order
- Description: Returns pre-filled data for the Sale Order form based on the Job Work.
- Includes conversion reference for automatic linking.

### Convert to Quotation
`GET` /api/job-works/:id/convert-to-quotation
- Description: Returns pre-filled data for the Quotation form based on the Job Work.
- Includes conversion reference for automatic linking.

### Duplicate
`GET` /api/job-works/:id/duplicate
- Description: Returns cleaned Job Work data (excluding ID, document number, status, etc.) for pre-filling a new Job Work form.

### Delete
`DELETE` /api/job-works/:id

## Attachment APIs

### Attach Files
`POST` /api/job-works/:id/attach-file
- Uploads multiple files (up to 10) to a job work.
- **Form Data**: `attachments` (file array)
- **Response**: Returns the updated `attachments` array with metadata.

### Get Attachments
`GET` /api/job-works/:id/attachments
- Retrieves all attachments linked to a job work.

### Update (Replace) Attachment
`PUT` /api/job-works/:id/attachment/:attachmentId
- Replaces an existing attachment.
- **Form Data**: `attachment` (single file)

### Delete Attachment
`DELETE` /api/job-works/:id/attachment/:attachmentId
- Permanently deletes an attachment.

## PDF & Sharing APIs

### Print Job Work
`GET` /api/job-works/:id/print
- Generates and returns a PDF for browser print preview.
- Supports query params: `original`, `duplicate`, `transport`, `office`.

### Download PDF
`GET` /api/job-works/:id/download-pdf
- Generates and triggers a download of the Job Work PDF.
- Supports single ID or comma-separated merged IDs.
- Supports same query params as Print.

### Share via Email
`POST` /api/job-works/:id/share-email
- Generates the PDF and sends it as an email attachment.
- Supports optional JSON body: `{ "email": "recipient@example.com" }`.

### Share via WhatsApp
`POST` /api/job-works/:id/share-whatsapp
- Generates a secure public link and returns a WhatsApp deep-link URL.
- Supports optional JSON body: `{ "phone": "919999999999" }`.

### Generate Public Link
`GET` /api/job-works/:id/public-link
- Generates and returns a secure, unauthenticated link for viewing the PDF.

### View Publicly
`GET` /api/job-works/view-public/:id/:token
- Public endpoint to view/download the PDF using a secure token.
