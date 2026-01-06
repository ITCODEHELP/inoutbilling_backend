
**Base URL**: `http://localhost:5000/api`

## Authentication

### Send OTP
```http
POST /auth/send-otp
Content-Type: application/json
```
**Request Body**
```json
{ "phone": "9876543210" }
```

### Verify OTP
```http
POST /auth/verify-otp
Content-Type: application/json
```
**Request Body**
```json
{ "phone": "9876543210", "otp": "123456" }
```

### Login
```http
POST /auth/login
Content-Type: application/json
```

### Login with User ID
```http
POST /auth/login-userid
Content-Type: application/json
```

### Resend OTP
```http
POST /auth/resend-otp
Content-Type: application/json
```

---

## User

### Update Profile
```http
POST /user/update-profile
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "gstNumber": "...",
  "companyName": "...",
  "address": "...",
  "pincode": "...",
  "city": "...",
  "state": "..."
}
```

---

## Customer

### Download Customers
```http
GET /customers/download-customers
Authorization: Bearer <token>
```
**Response**
- File download (`customers.xlsx`)

### Create Customer
```http
POST /customers
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "Acme Corp",
  "companyType": "Retail",
  "gstin": "27ABCDE...",
  "billingAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001"
  },
  "shippingAddress": {}
}
```
> **Note**: If `gstin` is not provided, the system will automatically generate it if valid `pan` and `billingAddress.state` are present.

### Get All Customers
```http
GET /customers
Authorization: Bearer <token>
```
**Response**
```json
[ { "companyName": "Acme Corp", ... } ]
```

### Get Customer by ID
```http
GET /customers/:id
Authorization: Bearer <token>
```

### Update Customer
```http
PUT /customers/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "companyName": "New Name" }
```
> **Note**: If `gstin` is currently empty and not provided in the update, providing `pan` and `billingAddress.state` will trigger auto-generation.

### Delete Customer
```http
DELETE /customers/:id
Authorization: Bearer <token>
```
**Response**
```json
{ "message": "Customer removed" }
```

---

## Import

### Import Customers
```http
POST /import/customers
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body**
- `file`: (Select an Excel/CSV file)

**Response**
```json
{
  "recordNumber": 10,
  "processedRange": "1-10",
  "statusSummary": "Completed",
  "action": [ ... ],
  "summary": { "total": 10, "success": 8, "duplicate": 1, "invalid": 1 }
}
```

---

## Product Bulk Edit

### Import Bulk Edit
```http
POST /products/bulk-edit/import
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body**
- `file`: (Select .xlsx/.csv)

### Export Bulk Edit
```http
GET /products/bulk-edit/export
Authorization: Bearer <token>
```
**Response**
- File download (`products_bulk_edit.xlsx`)

### Get Import Logs
```http
GET /products/bulk-edit/logs
Authorization: Bearer <token>
```

### Get Log Details
```http
GET /products/bulk-edit/logs/:id/details
Authorization: Bearer <token>
```

---

## Product

### Get Product Stats
```http
GET /products/stats
Authorization: Bearer <token>
```
**Response**
```json
{ "total": 10, "products": 8, "services": 2 }
```

### Create Product
```http
POST /products
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "name": "IPhone 15",
  "itemType": "Product",
  "tax": 18,
  "netPrice": 100000
}
```

### Get Products
```http
GET /products?page=1&limit=10&search=iphone
Authorization: Bearer <token>
```
**Response**
```json
{
  "data": [ ... ],
  "pagination": { "total": 100, "page": 1, "pages": 10 }
}
```

### Get Product by ID
```http
GET /products/:id
Authorization: Bearer <token>
```

### Update Product
```http
PUT /products/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Product
```http
DELETE /products/:id
Authorization: Bearer <token>
```

---

## Product Group

### Create Group
```http
POST /product-group
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "groupName": "Electronics", "description": "Gadgets" }
```

### Get Groups
```http
GET /product-group
Authorization: Bearer <token>
```

### Search Group
```http
GET /product-group/search?name=elec
Authorization: Bearer <token>
```

---

## Product Search (Counts)

### Get Search Counts
```http
GET /products/search-counts?productName=abc&productGroup=xyz
Authorization: Bearer <token>
```
**Response**
```json
{ "totalCount": 15, "productCount": 10, "serviceCount": 5 }
```

---

## Barcode Generate

### Add to Cart
```http
POST /barcode-generate/cart
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "productId": "...", "noOfLabels": 10 }
```

### Get Cart
```http
GET /barcode-generate/cart
Authorization: Bearer <token>
```

### Remove from Cart
```http
DELETE /barcode-generate/cart/:id
Authorization: Bearer <token>
```

### Generate Barcodes
```http
POST /barcode-generate/generate
Authorization: Bearer <token>
```
**Response**
```json
{
  "userId": "...",
  "items": [ { "generatedBarcodes": ["...", "..."] } ],
  "generatedAt": "..."
}
```

### Get History
```http
GET /barcode-generate/history
Authorization: Bearer <token>
```

---

## Barcode Customization

### Create Customization
```http
POST /barcode/customization
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "productId": "...",
  "noOfLabels": 10,
  "customizationName": "My Layout"
}
```

### Get Customizations
```http
GET /barcode/customization
Authorization: Bearer <token>
```

### Get Customization by ID
```http
GET /barcode/customization/:id
Authorization: Bearer <token>
```

### Update Customization
```http
PUT /barcode/customization/:id
Authorization: Bearer <token>
```

### Delete Customization
```http
DELETE /barcode/customization/:id
Authorization: Bearer <token>
```

---

## Manage Stock

### Manage Stock Search
```http
GET /products/manage-stock?page=1&limit=10&search=pix&productGroup=Mobile&stockStatus=Negative Stock
Authorization: Bearer <token>
```
**Response**
```json
{
  "data": [
    {
      "name": "Pixel 7",
      "currentStock": -2,
      "changeInStock": 0,
      "finalStock": -2
    }
  ],
  "pagination": { "total": 50, "page": 1, "pages": 5 }
}
```

---

## Sale Invoice

### Create Invoice
```http
POST /sale-invoice/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": { "ms": "...", "placeOfSupply": "..." },
  "invoiceDetails": { "invoiceNumber": "...", "date": "..." },
  "items": [ { "productName": "...", "qty": 1, "price": 100 } ],
  "totals": { "grandTotal": 100 },
  "paymentType": "CASH",
  "shareOnEmail": true,
  "createDeliveryChallan": true
}
```

### Create & Print Invoice
```http
POST /sale-invoice/create-print
Authorization: Bearer <token>
Content-Type: application/json
```

### Get Invoices
```http
GET /sale-invoice
Authorization: Bearer <token>
```

### Get Invoice by ID
```http
GET /sale-invoice/:id
Authorization: Bearer <token>
```

### Delete Invoice
```http
DELETE /sale-invoice/:id
Authorization: Bearer <token>
```

### Get Summary
```http
GET /sale-invoice/summary
Authorization: Bearer <token>
```
**Query Params**: `company`, `invoiceType`, `paymentType`, `fromDate`, `toDate`

---

## Vendor

### Create Vendor
```http
POST /vendor/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "...",
  "gstin": "...",
  "billingAddress": { ... }
}
```
> **Note**: If `gstin` is not provided, the system will automatically generate it if valid `pan` and `billingAddress.state` are present.

### Get Vendors
```http
GET /vendor
Authorization: Bearer <token>
```

### Get Vendor by ID
```http
GET /vendor/:id
Authorization: Bearer <token>
```

---

## Customer-Vendor

### Create Customer-Vendor
```http
POST /customer-vendor/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "companyName": "...",
  "billingAddress": { "state": "Maharashtra", "country": "India", ... },
  "pan": "..."
}
```
> **Note**: Triggers GSTIN auto-generation if `gstin` is missing but `pan` and `state` (in billingAddress) are provided.

### Get Customer-Vendors
```http
GET /customer-vendor
Authorization: Bearer <token>
```

---

## Purchase Invoice

### Create Purchase Invoice
```http
POST /purchase-invoice/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "vendorInformation": { "ms": "...", "placeOfSupply": "..." },
  "invoiceDetails": { "invoiceNumber": "...", "date": "..." },
  "items": [ { "productName": "...", "qty": 1, "price": 100 } ],
  "totals": { "grandTotal": 100 },
  "paymentType": "CASH"
}
```

### Create & Print Purchase Invoice
```http
POST /purchase-invoice/create-print
Authorization: Bearer <token>
Content-Type: application/json
```

### Get Summary
```http
GET /purchase-invoice/summary
Authorization: Bearer <token>
```

### Get Purchase Invoices
```http
GET /purchase-invoice
Authorization: Bearer <token>
```

### Search Purchase Invoices
```http
GET /purchase-invoice/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `productName`, `fromDate`, `toDate`, `invoiceNumber`

### Upload & Extract (AI)
```http
POST /purchase-invoice/upload-ai
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body**
- `invoice`: (PDF File)

### Confirm Extraction
```http
POST /purchase-invoice/confirm-ai
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "extractionId": "...", "continue": "Yes" }
```

### Get Purchase Invoice by ID
```http
GET /purchase-invoice/:id
Authorization: Bearer <token>
```

### Delete Purchase Invoice
```http
DELETE /purchase-invoice/:id
Authorization: Bearer <token>
```

---

## Additional Charges

### Create Charge
```http
POST /additional-charges
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "name": "Shipping",
  "price": 100,
  "hsnSacCode": "9965",
  "tax": 18,
  "isServiceItem": true
}
```

### Get Charges
```http
GET /additional-charges
Authorization: Bearer <token>
```

---

## Purchase Invoice Custom Fields

### Save Custom Fields
```http
POST /purchase-invoice/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "fields": [
    { "name": "Warranty", "type": "TEXT", "status": "Active" },
    { "name": "Type", "type": "DROPDOWN", "options": ["A", "B"] }
  ]
}
```

### Get Custom Fields
```http
GET /purchase-invoice/custom-fields
Authorization: Bearer <token>
```

---

## Product Custom Columns

### Save Custom Column
```http
POST /product/custom-columns
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customFieldName": "Shelf No",
  "status": "Enabled",
  "print": true
}
```

### Get Custom Columns
```http
GET /product/custom-columns
Authorization: Bearer <token>
```

---

## Membership & Subscription

### Seed Plans
```http
POST /api/setting-membership/seed-plans
```

### Get Plans
```http
GET /api/setting-membership/plans
```

### Get Current Membership
```http
GET /api/setting-membership/current
```

### Initiate Upgrade
```http
POST /api/setting-membership/upgrade
Content-Type: application/json
```
**Request Body**: `{ "planId": "..." }`

### Get Payment History
```http
GET /api/setting-membership/payments
```

---

## Credit Settings

### Get Balance
```http
GET /api/setting-credit/balance
```

### Get Credit Packs
```http
GET /api/setting-credit/packs
```

### Purchase Credits
```http
POST /api/setting-credit/purchase
Content-Type: application/json
```
**Request Body**: `{ "packId": "...", "transactionId": "...", "paymentType": "ONLINE" }`

### Get Usage Logs
```http
GET /api/setting-credit/logs
```

### Get Credit Payments
```http
GET /api/setting-credit/payments
```

---

## Login & Security Settings

### Request Phone Change OTP
```http
POST /api/setting-security/request-phone-change-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "newPhone": "9876543210" }`

### Verify Phone Change OTP
```http
POST /api/setting-security/verify-phone-change-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "newPhone": "...", "otp": "..." }`

### Request Email Change OTP
```http
POST /api/setting-security/request-email-change-otp
Authorization: Bearer <token>
```
**Body**: `{ "newEmail": "user@example.com" }`

### Verify Email Change OTP
```http
POST /api/setting-security/verify-email-change-otp
Authorization: Bearer <token>
```
**Body**: `{ "newEmail": "...", "otp": "..." }`

### Request Credentials OTP
```http
POST /api/setting-security/request-credentials-otp
Authorization: Bearer <token>
```
**Body**: `{ "userId": "...", "password": "...", "confirmPassword": "..." }`

### Verify Credentials OTP
```http
POST /api/setting-security/verify-credentials-otp
Authorization: Bearer <token>
```
**Body**: `{ "otp": "...", "userId": "...", "password": "..." }`

### Add Dispatch Address
```http
POST /api/setting-security/dispatch-address
Authorization: Bearer <token>
```
**Body**
```json
{
  "gstNumber": "...",
  "companyName": "My Branch",
  "addressLine1": "..."
}
```

### Get Dispatch Addresses
```http
GET /api/setting-security/dispatch-addresses
Authorization: Bearer <token>
```

### GSTIN Auto-Fill for Dispatch
```http
GET /api/setting-security/gst-autofill-dispatch
Authorization: Bearer <token>
```

### Get Business Profile
```http
GET /api/setting-security/business-profile
Authorization: Bearer <token>
```

### Request Business Profile OTP
```http
POST /api/setting-security/request-business-profile-otp
Authorization: Bearer <token>
```

### Verify & Update Business Profile
```http
POST /api/setting-security/verify-business-profile-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "otp": "...", "gstNumber": "...", ... }`

### Toggle E-Invoice
```http
POST /api/setting-security/toggle-einvoice
Authorization: Bearer <token>
```
**Body**: `{ "enabled": true }`

### Get E-Invoice Setting
```http
GET /api/setting-security/einvoice-setting
Authorization: Bearer <token>
```

### Update E-Way Credentials
```http
POST /api/setting-security/update-eway-credentials
Authorization: Bearer <token>
```
**Body**: `{ "userId": "primary...", "password": "...", "ewayBillUserId": "...", "ewayBillPassword": "..." }`

---

## Staff Management

### Create Staff
```http
POST /api/staff/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "userId": "...", "fullName": "...", "password": "...", "allowedSections": [...] }`

### Get Staff by Name
```http
GET /api/staff/search/:name
Authorization: Bearer <token>
```

### Get All Staff
```http
GET /api/staff/all
Authorization: Bearer <token>
```

### Update Security Settings
```http
POST /api/setting-security/update-settings
Authorization: Bearer <token>
```
**Body**: `{ "trackLoginLocation": true }`

### Get Login History
```http
GET /api/setting-security/history
Authorization: Bearer <token>
```

### Logout All Devices
```http
POST /api/setting-security/logout-all
Authorization: Bearer <token>
```

---

## Go Drive

### Search Documents
```http
GET /api/go-drive/search
Authorization: Bearer <token>
```
**Query Params**: `referenceType` (product/purchase_invoice/daily_expense/letter), `fromDate`, `toDate`, `searchAll`

---

## Digital Signature

### Upload Certificate
```http
POST /api/setting-digital-signature/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `pfxFile` (File), `password` (String)

### Toggle Signature
```http
POST /api/setting-digital-signature/toggle
Authorization: Bearer <token>
```
**Body**: `{ "enabled": true }`

### Get Status
```http
GET /api/setting-digital-signature/status
Authorization: Bearer <token>
```

---

## Activity Log

### Get Logs
```http
GET /api/activity-logs
Authorization: Bearer <token>
```
**Query Params**: `staffId`, `search`, `action`, `module`, `startDate`, `endDate`, `showAll`

---

## General Settings

### Get Settings
```http
GET /api/general-settings
Authorization: Bearer <token>
```

### Update Settings
```http
POST /api/general-settings/update
Authorization: Bearer <token>
```
**Body**: `{ "enableRounding": true, "dateFormat": "DD/MM/YYYY", ... }`

### Upload Branding Images
```http
POST /api/general-settings/upload-images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `logo`, `signature`, `background`, `footer`

---

## Product & Stock Options

### Get Settings
```http
GET /api/product-stock-settings
Authorization: Bearer <token>
```

### Save Settings
```http
POST /api/product-stock-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "productOptions": { "mrp": { "status": true }, ... },
  "stockOptions": { "allowSalesWithoutStock": true },
  "batchSettings": { "batchNo": { "status": true } }
}
```

---

## Print Template Settings

### Get Document Types
```http
GET /api/print-template-settings/document-types
Authorization: Bearer <token>
```

### Get Available Templates
```http
GET /api/print-template-settings/templates
Authorization: Bearer <token>
```

### Get Saved Configs
```http
GET /api/print-template-settings?branchId=main
Authorization: Bearer <token>
```

### Get Config by Doc Type
```http
GET /api/print-template-settings/document/Sale%20Invoice?branchId=main
Authorization: Bearer <token>
```

### Save Configs
```http
POST /api/print-template-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "branchId": "main",
  "templateConfigurations": [
    { "documentType": "Sale Invoice", "selectedTemplate": "Designed", "printSize": "A4" }
  ]
}
```

---

## Print Options

### Save Options
```http
POST /api/print-options
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "headerPrintSettings": { "showLogo": true },
  "footerPrintSettings": { "showSignature": true }
}
```

---

## Bank Details

### Save Bank Details
```http
POST /api/bank-details
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "bankId": "optional-uuid",
  "accountName": "John Doe",
  "bankName": "SBI",
  "accountNumber": "123456"
}
```

---

## Terms & Conditions

### Save Terms
```http
POST /api/terms-conditions
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "sale_invoice": "Payment within 30 days",
  "quotation": "Valid for 15 days"
}
```

### Get Terms
```http
GET /api/terms-conditions
Authorization: Bearer <token>
```

---

## Shipping & Envelope

### Save Settings
```http
POST /api/shipping-envelope-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "shipping_options": { ... }, "title": "DELIVERY INSTRUCTIONS" }`

### Get Settings
```http
GET /api/shipping-envelope-settings
Authorization: Bearer <token>
```

---

## Message Templates

### Save Templates
```http
POST /api/message-templates
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "Sales Invoice": { "email": { "subject": "..." }, "whatsapp": { "body": "..." } }
}
```

### Get Templates
```http
GET /api/message-templates
Authorization: Bearer <token>
```

---

## Payment Reminder

### Save Settings
```http
POST /api/payment-reminder-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "email_reminder_enabled": true }`

### Get Settings
```http
GET /api/payment-reminder-settings
Authorization: Bearer <token>
```

---

## Custom Header Design

### Save Design
```http
POST /api/custom-header-design
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "layout_type": "modern", "layers": [ ... ] }`

### Get Design
```http
GET /api/custom-header-design
Authorization: Bearer <token>
```

### Upload Image
```http
POST /api/custom-header-design/upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `image` (File)

### Get Header Shapes
```http
GET /api/header-shapes
Authorization: Bearer <token>
```

---

## Inward Payment

### Create Payment
```http
POST /api/inward-payments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**
- `receiptNo` (Required)
- `companyName` (Required)
- `amount` (Required)
- `paymentDate` (Required)
- `paymentType` (Required)
- `customFields` (Optional JSON String)
- `attachment` (Optional File)

### Get Payments
```http
GET /api/inward-payments
Authorization: Bearer <token>
```

### Get Summary
```http
GET /api/inward-payments/summary
Authorization: Bearer <token>
```

### Search Payments
```http
GET /api/inward-payments/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `receiptNo`, `fromDate`, `toDate`, `paymentType`, `amount`, `cf_<id>`

### Save Custom Fields
```http
POST /api/inward-payments/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "name": "...", "type": "TEXT/DATE/DROPDOWN" }`

### Get Custom Fields
```http
GET /api/inward-payments/custom-fields
Authorization: Bearer <token>
```

---

## Outward Payment

### Create Payment
```http
POST /api/outward-payments
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**
- `paymentNo` (Required)
- `companyName` (Required)
- `amount` (Required)
- `paymentDate` (Required)
- `paymentType` (Required)
- `customFields` (Optional JSON String)
- `attachment` (Optional File)

### Get Payments
```http
GET /api/outward-payments
Authorization: Bearer <token>
```

### Get Summary
```http
GET /api/outward-payments/summary
Authorization: Bearer <token>
```

### Search Payments
```http
GET /api/outward-payments/search
Authorization: Bearer <token>
```
**Query Params**: `companyName`, `paymentNo`, `fromDate`, `toDate`, `paymentType`, `amount`, `staffName`, `cf_<id>`

### Save Custom Fields
```http
POST /api/outward-payments/custom-fields
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "name": "...", "type": "TEXT/DATE/DROPDOWN" }`

### Get Custom Fields
```http
GET /api/outward-payments/custom-fields
Authorization: Bearer <token>
```

# [DAILY EXPENSE MODULE]

## Create Expense
`POST` /api/daily-expenses

### Header
> Authorization: Bearer <token>
> Content-Type: multipart/form-data

### Form-Data
- `expenseNo`: String (Required)
- `expenseDate`: Date (Required)
- `category`: String (Required)
- `isGstBill`: Boolean (true/false)
- `party`: ObjectId (Vendor/Company ID, Optional)
- `paymentType`: Enum (CASH, CHEQUE, ONLINE, BANK)
- `remarks`: String
- `attachment`: File (Image/Doc/PDF)
- `items`: JSON String (Array of objects: { name, note, quantity, price, amount })
- `customFields`: JSON String (Object: { fieldId: value, ... })
- `roundOff`: Number
- `grandTotal`: Number
- `amountInWords`: String

### Response
```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": { ... }
}
```

## List Expenses
`GET` /api/daily-expenses?page=1&limit=10

### Header
> Authorization: Bearer <token>

### Response
```json
{
  "success": true,
  "count": 10,
  "total": 50,
  "totalPages": 5,
  "currentPage": 1,
  "data": [ ... ]
}
```

## Search Expenses
`GET` /api/daily-expenses/search

### Query Parameters (All Optional)
- `companyName`: String (Partial, case-insensitive match on Vendor name)
- `staffName`: String (Partial, case-insensitive match on Staff name)
- `category`: String (Partial, case-insensitive match)
- `fromDate`: YYYY-MM-DD
- `toDate`: YYYY-MM-DD
- `title`: String (Search in remarks, description, or expenseNo)
- `itemNote`: String (Search inside item notes)
- `paymentType`: Enum (CASH, CHEQUE, ONLINE, BANK)
- `minAmount`: Number (Filter by grandTotal)
- `maxAmount`: Number (Filter by grandTotal)
- `expenseNo`: String (Partial match)
- `cf_<fieldId>`: Value (for custom fields)

### Response
```json
{
  "success": true,
  "count": 5,
  "data": [ ... ]
}
```

## Expense Summary
`GET` /api/daily-expenses/summary

### Query Parameters
- Supports the same filters as the **Search Expenses** API.

### Response
```json
{
  "success": true,
  "data": {
    "totalTransactions": 10,
    "totalValue": 5000
  }
}
```

## Manage Custom Fields

### Get All Fields
`GET` /api/daily-expenses/custom-fields

### Create Field
`POST` /api/daily-expenses/custom-fields
Body:
```json
{
  "name": "Field Name",
  "type": "TEXT|DATE|DROPDOWN",
  "options": ["Option1", "Option2"], // if DROPDOWN
  "required": true,
  "print": true,
  "orderNo": 1
}
```

### Update Field
`PUT` /api/daily-expenses/custom-fields/:id

### Delete Field
`DELETE` /api/daily-expenses/custom-fields/:id

## Manage Item Columns

### Get All Item Columns
`GET` /api/daily-expenses/item-columns

### Create Item Column
`POST` /api/daily-expenses/item-columns
Body:
```json
{
  "name": "Column Name",
  "type": "TEXT|NUMBER|DROPDOWN",
  "options": ["Option1", "Option2"], // if DROPDOWN
  "orderNo": 1
}
```

### Update Item Column
`PUT` /api/daily-expenses/item-columns/:id

### Delete Item Column
`DELETE` /api/daily-expenses/item-columns/:id

## Import Expenses
`POST` /api/daily-expenses/import

### Content-Type
`multipart/form-data`

### Body
- `file`: The Excel file (XLS/XLSX).

### Excel Format (Columns)
| Column | Description |
| --- | --- |
| `expenseNo` | Unique expense number (Req) |
| `expenseDate` | YYYY-MM-DD (Opt) |
| `category` | Expense Category (Opt) |
| `party` | Company/Vendor Name (Opt) |
| `staffName` | Staff Full Name (Opt) |
| `paymentType` | CASH, CHEQUE, ONLINE, BANK (Opt) |
| `remarks` | Expense remarks/title (Opt) |
| `description` | Detailed description (Opt) |
| `item_name` | Name of the expense item |
| `item_note` | Note for the item |
| `quantity` | Item quantity (Numeric) |
| `price` | Unit price (Numeric) |
| `roundOff` | Rounding amount (Opt) |
| `amountInWords` | Amount in words (Opt) |
| `cf_<fieldId>` | Value for dynamic custom field |

> [!NOTE]
> For multiple items in one expense, repeat the same `expenseNo` in multiple rows. The first row for an `expenseNo` will be used for header details.

### Response
```json
{
  "success": true,
  "message": "Import completed. 5 imported, 0 failed.",
  "results": {
    "totalRows": 5,
    "imported": 5,
    "failed": 0,
    "errors": []
  }
}
```

## Daily Expense Enhancement
`GET` /api/daily-expenses/:id/print
- Returns PDF receipt.
- Also supported via `print: true` in `POST /api/daily-expenses`.

## Import History
`GET` /api/daily-expenses/import-history

### Response
```json
{
  "success": true,
  "data": [
    {
      "_id": "677b63fbd55e8d53066986e8",
      "userId": "677618999818b2cb188e02d8",
      "fileName": "expenses.xlsx",
      "totalRows": 5,
      "importedCount": 4,
      "failedCount": 1,
      "errorLogs": [...],
      "status": "Completed",
      "createdAt": "2026-01-06T10:45:00.000Z",
      "updatedAt": "2026-01-06T10:45:05.000Z"
    }
  ]
}
```

## Expense Categories
`GET` /api/expense-categories
- Supports `?search=name` filter.

### Response
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "_id": "677b63fbd55e8d53066986e8",
      "name": "Fuel",
      "status": "Active"
    },
    {
      "_id": "677b63fbd55e8d53066986e9",
      "name": "Refreshments",
      "status": "Active"
    }
  ]
}
```

`POST` /api/expense-categories
- Body: `{ "name": "Category Name" }`

`PUT` /api/expense-categories/:id
- Body: `{ "name": "New Name" }`

`DELETE` /api/expense-categories/:id

## Other Income Categories
`GET` /api/other-income-categories
- Supports `?search=name&page=1&limit=10&sort=name&order=asc` filters.

`POST` /api/other-income-categories
- Body: `{ "name": "Category Name" }`

`PUT` /api/other-income-categories/:id
- Body: `{ "name": "New Name", "status": "Active|Inactive" }`

`DELETE` /api/other-income-categories/:id


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


## Proformas

### Custom Fields
`GET` /api/proformas/custom-fields
`POST` /api/proformas/custom-fields
`PUT` /api/proformas/custom-fields/:id
`DELETE` /api/proformas/custom-fields/:id

### Item Columns
`GET` /api/proformas/item-columns
`POST` /api/proformas/item-columns
`PUT` /api/proformas/item-columns/:id
`DELETE` /api/proformas/item-columns/:id

### List & Search
`GET` /api/proformas
- Supports Query Params:
  - `search`: Global search (Customer, No, Remarks, Product)
  - `showAll`: "true" to ignore filters
  - `company`: Search by customer name (M/S)
  - `product`: Search by product name
  - `productGroup`: Search by product group
  - `fromDate`, `toDate`: Date range for proforma date
  - `staffName`: Search by staff full name
  - `proformaNo`: Search by proforma number
  - `minAmount`, `maxAmount`: Search by grand total range
  - `lrNo`: Search by transport document number
  - `itemNote`: Search by item-level notes
  - `remarks`: Search by document remarks
  - `gstin`: Search by customer GSTIN/PAN
  - `proformaType`: Filter by type (Regular, Bill of Supply, etc.)
  - `shipTo`: Search by shipping address
  - `advanceFilter`: JSON object `{ "field": "Field Name", "operator": "operator", "value": "value" }`
  - `cf_<fieldId>`: Dynamic custom field filters.

### Summary Data
`GET` /api/proformas/summary
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
`POST` /api/proformas
- Body: `customerInformation`, `proformaDetails`, `transportDetails`, `items`, `totals`, `bankDetails`, `termsTitle`, `termsDetails`, `documentRemarks`, `customFields`, `print` (Boolean).

### Get Single
`GET` /api/proformas/:id

### Update
`PUT` /api/proformas/:id

### Delete
`DELETE` /api/proformas/:id

### Print PDF
`GET` /api/proformas/:id/print


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

## Other Incomes

### Custom Fields
`GET` /api/other-incomes/custom-fields
`POST` /api/other-incomes/custom-fields
`PUT` /api/other-incomes/custom-fields/:id
`DELETE` /api/other-incomes/custom-fields/:id
- Uses the same structure and storage as Daily Expense custom fields.

### Item Columns
`GET` /api/other-incomes/item-columns
`POST` /api/other-incomes/item-columns
`PUT` /api/other-incomes/item-columns/:id
`DELETE` /api/other-incomes/item-columns/:id
- Uses the same structure and storage as Daily Expense item columns.

### List & Search
`GET` /api/other-incomes
- Query Params: `search`, `fromDate`, `toDate`, `category`, `incomeNo`, `paymentType`, `minAmount`, `maxAmount`, `cf_<fieldId>`.

### Summary
`GET` /api/other-incomes/summary
- Same filters as List API.
- Returns `{ success: true, data: { totalTransactions, totalValue } }`.

### Create (with optional Save & Print)
`POST` /api/other-incomes
- Body Fields: `incomeNo`, `incomeDate`, `category`, `paymentType`, `remarks`, `items` (Array), `roundOff`, `amountInWords`, `customFields` (Object/Map), `print` (Boolean).

### Import
`POST` /api/other-incomes/import
- Content-Type: `multipart/form-data`
- File Field: `file`
- Excel Columns: `incomeNo`, `incomeDate`, `category`, `paymentType`, `remarks`, `incomeName`, `note`, `price`, `roundOff`, `amountInWords`, `cf_<fieldId>`.

### Download Sample Data
`GET` /api/other-incomes/import/sample
- Generates and downloads a sample Excel template for importing Other Income.
- Headers are dynamically generated based on active custom fields.


### Print Receipt
`GET` /api/other-incomes/:id/print
- Returns PDF.

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





