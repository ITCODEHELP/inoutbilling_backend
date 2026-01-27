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

### Download PDF
`GET` /api/quotations/:id/download-pdf
- `id` can be a single ID or a comma-separated list of IDs for merged PDFs.
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans).

### Share via Email
`POST` /api/quotations/:id/share-email
- `id` can be a single ID or comma-separated list.
- Body: `email` (Optional, defaults to customer email).
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans).

### Share via WhatsApp
`POST` /api/quotations/:id/share-whatsapp
- `id` can be a single ID or comma-separated list.
- Body: `phone` (Optional, defaults to customer phone).
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans).
- Returns: `whatsappNumber`, `deepLink`.

### Public Link (Copy Link)
`GET` /api/quotations/:id/public-link
- Generates a secure public URL for viewing the Quotation PDF.
- Query Params: `original`, `duplicate`, `transport`, `office` (Booleans) - determines which copies are included in the generated link.

### Public View PDF (Unprotected)
`GET` /api/quotations/view-public/:id/:token
- Renders the Quotation PDF without authentication if the token is valid.

### Convert to Sale Invoice
`GET` /api/quotations/:id/convert-to-invoice
- Fetches quotation data mapped specifically for the Sale Invoice "Add" form.
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "customerInformation": { ... },
      "items": [ { ... } ],
      "conversions": {
        "convertedFrom": {
            "docType": "Quotation",
            "docId": "..."
        }
      }
    }
  }
  ```
- **Note**: When this data is sent back to the `POST /api/sale-invoice/create` endpoint, the system automatically updates the source quotation with a conversion reference.

### Convert to Purchase Invoice
`GET` /api/quotations/:id/convert-to-purchase-invoice
- Fetches quotation data mapped for the Purchase Invoice "Add" form (maps Customer details to Vendor).

### Convert to Proforma Invoice
`GET` /api/quotations/:id/convert-to-proforma
- Fetches quotation data mapped for the Proforma Invoice "Add" form.

### Convert to Delivery Challan
`GET` /api/quotations/:id/convert-to-challan
- Fetches quotation data mapped for the Delivery Challan "Add" form.

### Convert to Purchase Order
`GET` /api/quotations/:id/convert-to-purchase-order
- Description: Returns pre-filled data for the Purchase Order form based on the Quotation.

### Convert to Sale Order
`GET` /api/quotations/:id/convert-to-sale-order
- Description: Returns pre-filled data for the Sale Order form based on the Quotation.
- Includes conversion reference for automatic linking.

### Duplicate
`GET` /api/quotations/:id/duplicate
- Description: Returns cleaned Quotation data (excluding ID, document number, status, etc.) for pre-filling a new Quotation form.

## Attachment APIs

### Attach Files
`POST` /api/quotations/:id/attach-file
- Uploads multiple files (up to 10) to a quotation.
- **Form Data**: `attachments` (file array)
- **Response**: Returns the updated `attachments` array with metadata (fileName, filePath, fileSize, mimeType, uploadedAt, uploadedBy).

### Get Attachments
`GET` /api/quotations/:id/attachments
- Retrieves all attachments linked to a quotation.

### Update (Replace) Attachment
`PUT` /api/quotations/:id/attachment/:attachmentId
- Replaces an existing attachment while preserving its reference order.
- **Form Data**: `attachment` (single file)

### Delete Attachment
`DELETE` /api/quotations/:id/attachment/:attachmentId
- Permanently deletes an attachment from the database and disk.

