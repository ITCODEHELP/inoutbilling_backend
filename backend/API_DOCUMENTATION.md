
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

### Get Proforma Summary
Returns aggregated totals for proformas.

**URL** : `/api/proformas/summary`
**Method** : `GET`
**Query Parameters** : (Same as List Proformas)
**Auth required** : YES

**Success Response**:
- **Code**: 200 OK
- **Content**: (Matches Quotation Summary format)

### Get Proforma by ID
```http
GET /proformas/:id
Authorization: Bearer <token>
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

### Get Quotation Summary
Returns aggregated totals for quotations based on search filters.

**URL** : `/api/quotations/summary`
**Method** : `GET`
**Query Parameters** : (Same as List Quotations)
**Auth required** : YES

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "data": {
    "totalTransactions": 15,
    "totalTaxable": 150000.00,
    "totalCGST": 13500.00,
    "totalSGST": 13500.00,
    "totalIGST": 0.00,
    "totalValue": 177000.00
  }
}
```

### Get Quotation by ID
```http
GET /quotations/:id
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

### Get Sale Order Summary
Returns aggregated totals for sale orders.

**URL** : `/api/sale-orders/summary`
**Method** : `GET`
**Query Parameters** : (Same as List Sale Orders)
**Auth required** : YES

**Success Response**:
- **Code**: 200 OK
- **Content**: (Matches Quotation Summary format)

### Get Sale Order by ID
```http
GET /sale-orders/:id
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

### Get Purchase Order Summary
Returns aggregated totals for purchase orders.

**URL** : `/api/purchase-orders/summary`
**Method** : `GET`
**Query Parameters** : (Same as List Purchase Orders)
**Auth required** : YES

**Success Response**:
- **Code**: 200 OK
- **Content**: (Matches Quotation Summary format)

### Get Purchase Order by ID
```http
GET /purchase-orders/:id
Authorization: Bearer <token>
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


## Shared Logic: Backend Calculation Utiltiy

All document modules (Quotation, Proforma, Delivery Challan, Sale Order, Job Work, and Purchase Order) use a centralized backend calculation utility (`calculateDocumentTotals`). 

### Calculation Flow:
1. **GST Splitting**: 
   - Compares the `placeOfSupply` (from customer/vendor info) with the source state (from the selected branch or user profile).
   - If states match: Intra-state (IGST = 0, CGST = Rate/2, SGST = Rate/2).
   - If states differ: Inter-state (IGST = Rate, CGST = 0, SGST = 0).
2. **Item Totals**:
   - `Taxable Value = Quantity * Price * (1 - Discount/100)`.
   - `Item Total = Taxable Value + CGST + SGST + IGST`.
3. **Document Aggregates**:
   - Sums all item-level taxable values, taxes, and additional charges.
   - Applies rounding to the `Grand Total`.
   - Automatically generates `Total In Words`.

### Frontend Responsibility:
The frontend only needs to send `qty`, `price`, `discount`, and the base `igst` rate. All other totals and individual tax amounts will be computed and persisted by the backend.

---

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

---

## Shipping Distance Logic
All document creation APIs (Quotation, Sales Order, Proforma, Delivery Challan, Purchase Order, Job Work) now automatically calculate and store `distance` in kilometers in the `shippingAddress` object based on the source branch (Dispatch Address or User Profile) and destination pincode.
If `useSameShippingAddress` is true, billing address details are used.

---

## Letters

### Create Letter
```http
POST /api/letters
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "title": "Appointment Letter",
  "letterNumber": {
    "prefix": "ALT",
    "number": "001",
    "postfix": "2024"
  },
  "letterDate": "2024-01-01",
  "templateType": "BLANK",
  "letterBody": "Dear {{name}}, this is your letter for {{letter-no}} on {{letter-date}}."
}
```

### Get All Letters
```http
GET /api/letters?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "count": 1,
  "total": 1,
  "page": 1,
  "pages": 1,
  "data": [ ... ]
}
```

### Search Letters
```http
GET /api/letters/search?title=appointment&fromDate=2024-01-01&toDate=2024-12-31&letterNo=ALT&staffName=John
Authorization: Bearer <token>
```
**Query Parameters**
- `title`: Partial match (case-insensitive)
- `fromDate`, `toDate`: Date range for `letterDate`
- `letterNo`: Match prefix, number, or postfix
- `staffName`: Partial match for staff name (resolves to ID)
- `page`, `limit`, `sort`, `order`: Pagination and sorting

### Get Letter by ID
```http
GET /api/letters/:id
Authorization: Bearer <token>
```

### Update Letter
```http
PUT /api/letters/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "title": "Updated Title",
  "letterBody": "Updated content with placeholders..."
}
```

### Delete Letter (Soft Delete)
```http
DELETE /api/letters/:id
Authorization: Bearer <token>
```

---

## Packing List

### Create Packing List
```http
POST /api/packing-list
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "Acme Corp",
    "address": "123 Street",
    "contactPerson": "John Doe",
    "phone": "9876543210",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra"
  },
  "packingListDetails": {
    "prefix": "PK",
    "number": "001",
    "invoiceNumber": "INV-101",
    "invoiceDate": "2024-01-01",
    "invoiceType": "Regular"
  },
  "items": [
    {
      "productDescription": "Widget A",
      "qty": 100,
      "grossWeight": 50,
      "netWeight": 45,
      "productGroup": "Electronics"
    }
  ],
  "totals": {
    "totalPackages": 1,
    "totalGrossWeight": 50,
    "totalNetWeight": 45
  },
  "saveAndPrint": true
}
```
> **Note**: Set `saveAndPrint: true` to generate a PDF and store the URL in `pdfUrl`.

### Get Packing Lists (with Search)
```http
GET /api/packing-list?company=Acme&productGroup=Electronics&invoiceNo=INV-101&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`, `product`, `productGroup`, `invoiceNo`, `challanNo`, `itemNote`, `remarks`, `gstin`, `invoiceType`
- `fromDate`, `toDate` (based on `invoiceDate`)
- `staffName` (resolves to staff owner)
- `page`, `limit`, `sort`, `order`

### Download Packing List PDF
```http
GET /api/packing-list/:id/download
Authorization: Bearer <token>
```

### Delete Packing List
DELETE /api/packing-list/:id
Authorization: Bearer <token>
```

---

## Manufacture

### Create Manufacture Entry
```http
POST /api/manufacture
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "product": "507f1f77bcf86cd799439011",
  "quantity": 100,
  "uom": "Pieces",
  "manufactureNumber": "MFG-001",
  "manufactureDate": "2024-01-15",
  "rawMaterials": [
    {
      "productName": "Steel Sheet",
      "qty": 50,
      "uom": "kg",
      "price": 100,
      "itemNote": "Grade A"
    }
  ],
  "otherOutcomes": [
    {
      "productName": "Scrap Metal",
      "qty": 5,
      "price": 20
    }
  ],
  "adjustment": {
    "type": "Rs",
    "value": 500,
    "sign": "+"
  },
  "documentRemarks": "First batch",
  "customFields": {
    "batchCode": "BATCH-A1"
  }
}
```
> **Note**: All totals (`rawMaterialTotal`, `otherOutcomeTotal`, `grandTotal`, `unitPrice`, `totalInWords`) are calculated automatically by the backend.

### Get Manufactures (Paginated)
```http
GET /api/manufacture?page=1&limit=10&sort=manufactureDate&order=desc
Authorization: Bearer <token>
```

### Get Manufacture by ID
```http
GET /api/manufacture/:id
Authorization: Bearer <token>
```

### Update Manufacture
```http
PUT /api/manufacture/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Search Manufactures
```http
GET /api/manufacture/search?productName=Steel&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `productName`: Search for product names within `rawMaterials` and `otherOutcomes` arrays (case-insensitive partial match)
- `fromDate`, `toDate`: Date range filter on `manufactureDate`
- `page`, `limit`: Pagination

**Implementation Note**: This endpoint searches for the product name text within the `rawMaterials.productName` and `otherOutcomes.productName` fields using $regex, not by looking up the referenced Product document.

**Response (No Records)**
```json
{
  "success": true,
  "data": [],
  "message": "No record found"
}
```

---

## Credit Note

### Create Credit Note
```http
POST /api/credit-note
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "ABC Corporation",
    "address": "123 Main St",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "creditNoteDetails": {
    "cnNumber": "CN-0001",
    "cnDate": "2024-01-15",
    "invoiceNumber": "INV-2024-001",
    "invoiceDate": "2024-01-10",
    "docType": "Regular",
    "cnType": "Price Difference",
    "deliveryMode": "By Hand"
  },
  "items": [
    {
      "productName": "Product A",
      "qty": 10,
      "price": 100,
      "discount": 5,
      "igst": 18
    }
  ],
  "additionalCharges": [
    {
      "name": "Packing",
      "amount": 50,
      "tax": 9
    }
  ],
  "useSameShippingAddress": true
}
```
> **Note**: All totals (totalCreditValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using shared calculation utilities. Tax determination (IGST vs CGST+SGST) is based on place of supply comparison.

### Get Credit Notes (Paginated)
```http
GET /api/credit-note?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```

### Get Credit Note by ID
```http
GET /api/credit-note/:id
Authorization: Bearer <token>
```

### Update Credit Note
```http
PUT /api/credit-note/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Credit Note
```http
DELETE /api/credit-note/:id
Authorization: Bearer <token>
```

### Search Credit Notes
```http
GET /api/credit-note/search?company=ABC&product=Widget&fromDate=2024-01-01&toDate=2024-12-31&cnType=Price%20Difference
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, C.N. number, remarks, product names
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on C.N. Date
- `staffName`: Filter by staff name (resolves to ID)
- `cnNumber`, `creditNoteNumber`: Search in prefix/number/postfix
- `minTotal`, `maxTotal`: Filter by grand total range
- `lrNo`: Search in customFields.lr_no
- `eWayBill`: Search in customFields.eway_bill
- `itemNote`: Filter by item notes
- `remarks`: Filter by document remarks
- `gstin`: Filter by GSTIN/PAN
- `cnType`, `creditNoteType`: Filter by Credit Note Type
- `docType`: Filter by Document Type
- `shippingAddress`: Search in shipping address fields
- `advField`, `advOperator`, `advValue`: Advanced filter (operators: eq, ne, gt, gte, lt, lte, contains)
- `page`, `limit`, `sort`, `order`: Pagination and sorting

**Response (No Records)**
```json
{
  "success": true,
  "data": [],
  "message": "No record found"
}
```

**Response (With Results)**
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "page": 1,
  "pages": 3,
  "data": [...]
}
```

### Get Credit Note Summary
```http
GET /api/credit-note/summary?company=ABC&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on C.N. Date

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 10,
    "totalTaxable": 50000,
    "totalCGST": 4500,
    "totalSGST": 4500,
    "totalIGST": 0,
    "totalValue": 59000
  }
}
```

---

## Debit Note

### Create Debit Note
```http
POST /api/debit-note
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "XYZ Corporation",
    "address": "456 Market St",
    "gstinPan": "27XYZAB1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "debitNoteDetails": {
    "dnNumber": "DN-0001",
    "dnDate": "2024-01-20",
    "invoiceNumber": "INV-2024-005",
    "invoiceDate": "2024-01-15",
    "docType": "Regular",
    "dnType": "Quantity Shortage",
    "deliveryMode": "Courier"
  },
  "items": [
    {
      "productName": "Product B",
      "qty": 5,
      "price": 200,
      "discount": 10,
      "igst": 18
    }
  ],
  "additionalCharges": [
    {
      "name": "Freight",
      "amount": 100,
      "tax": 18
    }
  ],
  "useSameShippingAddress": true
}
```
> **Note**: All totals (totalDebitValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using shared calculation utilities. Tax determination (IGST vs CGST+SGST) is based on place of supply comparison.

### Get Debit Notes (Paginated)
```http
GET /api/debit-note?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```

### Get Debit Note by ID
```http
GET /api/debit-note/:id
Authorization: Bearer <token>
```

### Update Debit Note
```http
PUT /api/debit-note/:id
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete Debit Note
```http
DELETE /api/debit-note/:id
Authorization: Bearer <token>
```

### Search Debit Notes
```http
GET /api/debit-note/search?company=XYZ&product=Widget&fromDate=2024-01-01&toDate=2024-12-31&dnType=goods%20return
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, D.N. number, remarks, product names, item notes
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on D.N. Date
- `staffName`: Filter by staff name (resolves to ID)
- `dnNumber`, `debitNoteNumber`: Search in prefix/number/postfix
- `minTotal`, `maxTotal`: Filter by grand total range
- `lrNo`: Search in customFields.lr_no
- `eWayBill`: E-Way Bill filter with modes:
  - `without` or `without e-way bill`: Records without E-Way Bill
  - `with` or `with e-way bill`: Records with active E-Way Bill
  - `cancelled` or `cancelled e-way bill`: Records with cancelled E-Way Bill
  - Direct number: Search by E-Way Bill number
- `itemNote`: Filter by item notes
- `remarks`: Filter by document remarks
- `gstin`: Filter by GSTIN/PAN
- `dnType`, `debitNoteType`: Filter by Debit Note Type (enum: goods return, discount after save, correction in invoice)
- `docType`: Filter by Document Type (enum: regular, bill of supply, sez debit note (with IGST), sez debit note (without IGST), export debit(with IGST), export debit(without IGST))
- `shippingAddress`: Search in shipping address fields
- `advField`, `advOperator`, `advValue`: Advanced filter (operators: eq, ne, gt, gte, lt, lte, contains)
- `page`, `limit`, `sort`, `order`: Pagination and sorting

**Response (No Records)**
```json
{
  "success": true,
  "data": [],
  "message": "No record found"
}
```

**Response (With Results)**
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "page": 1,
  "pages": 3,
  "data": [...]
}
```

### Get Debit Note Summary
```http
GET /api/debit-note/summary?company=XYZ&fromDate=2024-01-01&toDate=2024-12-31
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on D.N. Date

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 8,
    "totalTaxable": 40000,
    "totalCGST": 3600,
    "totalSGST": 3600,
    "totalIGST": 0,
    "totalValue": 47200
  }
}
```

---

## Multi-Currency Export Invoice

### Create Multi-Currency Export Invoice
```http
POST /api/export-invoice
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "customerInformation": {
    "ms": "Global Export Corp",
    "address": "789 Export Street, Mumbai",
    "contactPerson": "John Doe",
    "phone": "+91-9876543210",
    "gstinPan": "27ABCDE1234F1Z1",
    "placeOfSupply": "Maharashtra",
    "reverseCharge": false
  },
  "invoiceDetails": {
    "invoiceType": "Export Invoice (With IGST)",
    "invoicePrefix": "EXP",
    "invoiceNumber": "EXP-0001",
    "invoicePostfix": "",
    "date": "2024-01-25",
    "deliveryMode": "Sea Freight"
  },
  "currency": {
    "code": "AED",
    "symbol": "AED"
  },
  "exportShippingDetails": {
    "shipBillNo": "SB-2024-001",
    "shipBillDate": "2024-01-20",
    "shipPortCode": "INMUM",
    "preCarriageBy": "Road",
    "placeOfPreCarriage": "Mumbai",
    "vesselOrFlightNo": "MV-OCEAN-123",
    "portOfLoading": "Mumbai Port",
    "portOfDischarge": "Dubai Port",
    "finalDestination": "Dubai, UAE",
    "countryOfOrigin": "India",
    "countryOfFinal": "UAE",
    "weightKg": 5000,
    "packages": 50
  },
  "items": [
    {
      "productName": "Textile Goods",
      "productGroup": "Textiles",
      "itemNote": "Export quality",
      "hsnSac": "5208",
      "qty": 100,
      "uom": "PCS",
      "price": 50,
      "discount": 5,
      "igst": 0
    }
  ],
  "additionalCharges": [
    {
      "name": "Freight Charges",
      "amount": 500,
      "tax": 0
    }
  ],
  "useSameShippingAddress": false,
  "shippingAddress": {
    "street": "789 Export Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pincode": "400001"
  },
  "staff": "60f1b2c3d4e5f6a7b8c9d0e1",
  "branch": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e2",
    "state": "Maharashtra"
  },
  "bankDetails": {
    "bankName": "Export Bank",
    "accountNumber": "1234567890",
    "ifscCode": "EXBK0001234"
  },
  "termsTitle": "Terms & Conditions",
  "termsDetails": [
    "Payment within 30 days",
    "FOB Mumbai Port"
  ],
  "documentRemarks": "Export invoice for UAE shipment",
  "shareOnEmail": false,
  "customFields": {}
}
```
**Invoice Type Options**
- `Export Invoice (With IGST)`: IGST is entered by user, CGST/SGST are derived from IGST when applicable (CGST = IGST ÷ 2, SGST = IGST ÷ 2). Manual CGST/SGST entry is prevented.
- `Export Invoice (Without IGST)`: No IGST applied, no CGST/SGST.

**Currency Support**
- Supported currency codes: `AED`, `USD`, `EUR`, `GBP`, `SAR`, `INR`
- Currency is stored in database and reflected in totals and "total in words"

**Required Fields**
- `customerInformation.ms`: Customer name (M/S)
- `customerInformation.placeOfSupply`: Place of supply
- `invoiceDetails.invoiceType`: Must be "Export Invoice (With IGST)" or "Export Invoice (Without IGST)"
- `invoiceDetails.invoiceNumber`: Invoice number (auto-generated if not provided)
- `invoiceDetails.date`: Invoice date
- `currency.code`: Currency code (default: "AED")
- `exportShippingDetails.shipBillNo`: Shipping Bill Number
- `exportShippingDetails.shipBillDate`: Shipping Bill Date
- `exportShippingDetails.shipPortCode`: Port Code
- `exportShippingDetails.portOfLoading`: Port of Loading
- `exportShippingDetails.portOfDischarge`: Port of Discharge
- `exportShippingDetails.finalDestination`: Final Destination
- `exportShippingDetails.countryOfOrigin`: Country of Origin
- `exportShippingDetails.countryOfFinal`: Country of Final Destination
- `items`: Array of items (at least one item required)
  - `productName`: Required
  - `qty`: Required, must be > 0
  - `price`: Required, must be > 0

> **Note**: All totals (totalInvoiceValue, totalTaxable, totalTax, CGST/SGST/IGST, roundOff, grandTotal, totalInWords) are calculated automatically by the backend using multi-currency export invoice calculation utilities. For Export Invoice (With IGST), IGST is entered by user and CGST/SGST are derived from IGST when applicable (CGST = IGST ÷ 2, SGST = IGST ÷ 2). Manual CGST/SGST entry is prevented. Currency is reflected in "total in words" (e.g., "Dirhams One Thousand Only" for AED).

**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice created successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "userId": "60f1b2c3d4e5f6a7b8c9d0e0",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": {
      "code": "AED",
      "symbol": "AED"
    },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": {
      "totalInvoiceValue": 5250,
      "totalTaxable": 4750,
      "totalTax": 0,
      "totalCGST": 0,
      "totalSGST": 0,
      "totalIGST": 0,
      "roundOff": 0,
      "grandTotal": 5250,
      "totalInWords": "Dirhams Five Thousand Two Hundred Fifty Only"
    },
    "createdAt": "2024-01-25T10:00:00.000Z",
    "updatedAt": "2024-01-25T10:00:00.000Z"
  }
}
```

### Get Multi-Currency Export Invoices (Paginated)
```http
GET /api/export-invoice?page=1&limit=10&sort=createdAt&order=desc
Authorization: Bearer <token>
```
**Query Parameters**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `sort`: Sort field (default: createdAt)
- `order`: Sort order - `asc` or `desc` (default: desc)

**Response**
```json
{
  "success": true,
  "total": 50,
  "page": 1,
  "pages": 5,
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
      "customerInformation": { ... },
      "invoiceDetails": { ... },
      "currency": { ... },
      "exportShippingDetails": { ... },
      "items": [ ... ],
      "totals": { ... }
    }
  ]
}
```

### Get Multi-Currency Export Invoice by ID
```http
GET /api/export-invoice/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": { ... },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": { ... },
    "staff": {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e1",
      "fullName": "John Smith"
    }
  }
}
```

### Update Multi-Currency Export Invoice
```http
PUT /api/export-invoice/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
Same structure as Create Multi-Currency Export Invoice. All fields are optional - only provided fields will be updated.

**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice updated successfully",
  "data": {
    "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
    "customerInformation": { ... },
    "invoiceDetails": { ... },
    "currency": { ... },
    "exportShippingDetails": { ... },
    "items": [ ... ],
    "totals": { ... },
    "updatedAt": "2024-01-25T11:00:00.000Z"
  }
}
```

### Delete Multi-Currency Export Invoice
```http
DELETE /api/export-invoice/:id
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "message": "Multi-Currency Export Invoice deleted successfully"
}
```

### Search Multi-Currency Export Invoices
```http
GET /api/export-invoice/search?company=Global&product=Textile&fromDate=2024-01-01&toDate=2024-12-31&invoiceType=Export%20Invoice%20(With%20IGST)&currency=AED
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Keyword search across M/S, invoice number, remarks, product names, item notes, shipping bill number, ports
- `company`, `customerName`: Filter by customer M/S (partial match)
- `product`, `productName`: Filter by product name in items (partial match)
- `productGroup`: Filter by product group (partial match)
- `fromDate`, `toDate`: Date range filter on invoice date
- `staffName`: Filter by staff name (resolves to ID)
- `invoiceNumber`: Search in prefix/number/postfix
- `invoiceType`: Filter by invoice type - "Export Invoice (With IGST)" or "Export Invoice (Without IGST)"
- `currency`: Filter by currency code (e.g., AED, USD, EUR)
- `minTotal`, `maxTotal`: Filter by grand total range
- `page`, `limit`, `sort`, `order`: Pagination and sorting

**Response (No Records)**
```json
{
  "success": true,
  "data": [],
  "message": "No record found"
}
```

**Response (With Results)**
```json
{
  "success": true,
  "count": 5,
  "total": 25,
  "page": 1,
  "pages": 3,
  "data": [
    {
      "_id": "60f1b2c3d4e5f6a7b8c9d0e3",
      "customerInformation": { ... },
      "invoiceDetails": { ... },
      "currency": { ... },
      "exportShippingDetails": { ... },
      "items": [ ... ],
      "totals": { ... }
    }
  ]
}
```

### Get Multi-Currency Export Invoice Summary
```http
GET /api/export-invoice/summary?company=Global&fromDate=2024-01-01&toDate=2024-12-31&invoiceType=Export%20Invoice%20(With%20IGST)&currency=AED
Authorization: Bearer <token>
```
**Query Parameters**
- `company`: Filter by customer M/S (partial match)
- `fromDate`, `toDate`: Date range filter on invoice date
- `invoiceType`: Filter by invoice type
- `currency`: Filter by currency code

**Response**
```json
{
  "success": true,
  "data": {
    "totalTransactions": 15,
    "totalTaxable": 75000,
    "totalCGST": 0,
    "totalSGST": 0,
    "totalIGST": 6750,
    "totalValue": 81750
  }
}
```

---

## Refer-API

### Get Referral Stats
Returns secure referral code, URL, share links, and counts.
```http
GET /api/referral/stats
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "referralCode": "A1B2C3D4E5",
    "referralUrl": "http://localhost:5000/api/referral/go/A1B2C3D4E5",
    "shareLinks": {
      "whatsapp": "...",
      "facebook": "...",
      "twitter": "...",
      "email": "..."
    },
    "totalReferrals": 10,
    "premiumReferrals": 2
  }
}
```

### Resolve Referral Code
Public headless endpoint to resolve a referral code and get referrer metadata.
```http
GET /api/referral/go/:referralCode
```
**Response**
```json
{
  "success": true,
  "data": {
    "referralCode": "A1B2C3D4E5",
    "referrer": {
      "companyName": "Acme Corp",
      "countryCode": "+91",
      "phone": "98******10"
    },
    "suggestedRedirect": "/signup"
  }
}
```

### Track Referral
Link a signup to the referrer using `referralCode`. Validates referred user existence, self-referral, and duplicates.
```http
POST /api/referral/track
Content-Type: application/json

{
  "referralCode": "A1B2C3D4E5",
  "referredId": "65866847c20c4a457c123456"
}
```

---

## WhatsApp-API

### Get WhatsApp Config
Returns business number, working hours, and personalized deep link.
```http
GET /api/whatsapp/config
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "businessNumber": "9725306146",
    "workingHours": "...",
    "messageTemplate": "...",
    "deepLink": "https://wa.me/..."
  }
}
```

### Track Interaction
Logs a click interaction on the WhatsApp link.
```http
POST /api/whatsapp/track
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourcePage": "Dashboard"
}
```
**Response**
```json
{
  "success": true,
  "message": "Interaction logged successfully",
  "data": {
    "id": "...",
    "timestamp": "..."
  }
}
```

---

## Email-API

### Get Support Email Config
Returns business support email, expected response time, and personalized mailto link.
```http
GET /api/support-email/config
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "supportEmail": "support@inoutbilling.com",
    "expectedResponseTime": "within 24 hours",
    "subject": "...",
    "body": "...",
    "mailtoLink": "mailto:support@inoutbilling.com?subject=..."
  }
}
```

---

## Support-PIN-API

### Generate Support PIN
Generates an 8-minute 6-digit numeric support PIN.
```http
POST /api/support-pin/generate
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": {
    "pin": "123456",
    "expiresAt": "..."
  }
}
```

### Verify Support PIN
Verifies a support PIN.
```http
POST /api/support-pin/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "123456",
  "userId": "..."
}
```
**Response**
```json
{
  "success": true,
  "message": "PIN verified successfully"
}
```

---

## Shortcut-Key-API

### Get Shortcut Definitions
Returns master shortcut configuration.
```http
GET /api/shortcuts/definitions
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": [
    {
      "moduleName": "Sales",
      "actionLabel": "Create Invoice",
      "keyCombination": "Alt+S+I",
      "targetRoute": "/sales/invoice/create"
    }
  ]
}
```

### Update Shortcut Preference
Global toggle for shortcut functionality.
```http
PATCH /api/shortcuts/preference
Authorization: Bearer <token>
Content-Type: application/json

{
  "isEnabled": false
}
```

---

## Financial-Year-API

### Get All Financial Years
Master list of FY options.
```http
GET /api/financial-year/years
Authorization: Bearer <token>
```

### Get Active Financial Year
User's currently selected FY context.
```http
GET /api/financial-year
Authorization: Bearer <token>
```

### Set Active Financial Year
Globally scope subsequent data requests.
```http
PATCH /api/financial-year
Authorization: Bearer <token>
Content-Type: application/json

{
  "financialYearId": "658668..."
}
```

---
