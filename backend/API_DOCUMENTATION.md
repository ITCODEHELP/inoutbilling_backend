BASE URL
  http://localhost:5000/api

POST /auth/send-otp
POST /auth/verify-otp
POST /auth/login
POST /auth/login-userid
POST /auth/resend-otp

POST /user/update-profile
Header: Authorization: Bearer <token>
Body: { "gstNumber": "...", "companyName": "...", "address": "...", "pincode": "...", "city": "...", "state": "..." }

GET /customers/download-customers
Response: File download (customers.xlsx)

CUSTOMER CRUD OPERATIONS
------------------------

POST /customers
Header: Authorization: Bearer <token>
Body: {
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
  "shippingAddress": { ... },
  ...
}

GET /customers
Header: Authorization: Bearer <token>
Response: [ { ...customer object... }, ... ]

GET /customers/:id
Header: Authorization: Bearer <token>
Response: { ...customer object... }

PUT /customers/:id
Header: Authorization: Bearer <token>
Body: { ...fields to update... }
Response: { ...updated customer object... }

DELETE /customers/:id
Header: Authorization: Bearer <token>
Response: { "message": "Customer removed" }


IMPORT MODULE
-------------

POST /import/customers
Header: Authorization: Bearer <token>
Body: form-data
  - key: file
  - value: (Select an Excel/CSV file)
Response:
{
  "recordNumber": 10,
  "processedRange": "1-10",
  "statusSummary": "Completed",
  "action": [
    {
      "recordNumber": 1,
      "status": "Invalid",
      "action": "Invalid",
      "details": "Missing required fields: City",
      "data": { ... }
    },
    {
      "recordNumber": 2,
      "status": "Success",
      "action": "Successfully Imported",
      "data": { ... }
    }
  ],
  "summary": {
    "total": 10,
    "success": 8,
    "duplicate": 1,
    "invalid": 1
  }
}


PRODUCT BULK EDIT IMPORT/EXPORT
-------------------------------

POST /products/bulk-edit/import
Header: Authorization: Bearer <token>
Body: form-data (file: .xlsx/.csv)
Description: Import products with strict validation of 46 headers. Updates by 'Product id'.
Headers Required: Product id, Product name, Product note, Barcode no, Sell price, Sell price incl tax, Purchase price, Purchase price incl tax, Hsn/sac code, Unit of measurement, Product type, No-itc, Gst %, Cess %, Cess type, Active product, Is service product ?, Non-salable product?, Product group, Stock type, Stock id, Batch no, Model no, Size, Mfg date, Expiry date, Mrp, Low stock alert, Discount sale, Discount in sale, Discount purchase, Discount in purchase, Product code, Is manufacturing, Gstin, Category, Date, Expense type, Discount in, Title, Description, Quantity, Rate, Uom, Discount, Taxable / amount, Tax%, Cess%
Response:
{
  "recordNumber": 10,
  "processedRange": "1-10",
  "statusSummary": "Completed",
  "summary": { "total": 10, "success": 9, "duplicate": 0, "invalid": 1 },
  "logId": "65e..."
}

GET /products/bulk-edit/export
Header: Authorization: Bearer <token>
Response: File download (products_bulk_edit.xlsx)

GET /products/bulk-edit/logs
Header: Authorization: Bearer <token>
Response: [ { "filename": "import.xlsx", "successCount": 10, ... } ]

GET /products/bulk-edit/logs/:id/details
Header: Authorization: Bearer <token>
Response: { 
  "details": [ 
    { "recordNumber": 1, "status": "Success", "action": "Updated", "details": "Updated product: iPhone 15" } 
  ] 
}

PRODUCT MODULE
--------------

GET /products/stats
Header: Authorization: Bearer <token>
Response: { "total": 10, "products": 8, "services": 2 }

POST /products
Header: Authorization: Bearer <token>
Body: {
  "name": "IPhone 15",
  "itemType": "Product",
  "tax": 18,
  "netPrice": 100000,
  ... (all other fields)
}

GET /products?page=1&limit=10&search=iphone
Header: Authorization: Bearer <token>
Response: {
  "data": [ ... ],
  "pagination": { "total": 100, "page": 1, "pages": 10 }
}

GET /products/:id
Header: Authorization: Bearer <token>
Response: { ...product... }

PUT /products/:id
Header: Authorization: Bearer <token>
Body: { ...fields to update... }

DELETE /products/:id
Header: Authorization: Bearer <token>
Response: { "message": "Product removed" }

PRODUCT GROUP MODULE
--------------------

POST /product-group
Header: Authorization: Bearer <token>
Body: { "groupName": "Electronics", "description": "Gadgets and devices" }
Response: { ...group... }

GET /product-group
Header: Authorization: Bearer <token>
Response: [ { "groupName": "Electronics", ... }, ... ]

GET /product-group/search?name=elec
Header: Authorization: Bearer <token>
Response: [ { "groupName": "Electronics", ... } ]


PRODUCT SEARCH - COUNTS ONLY
----------------------------

GET /products/search-counts?productName=abc&productGroup=xyz
Header: Authorization: Bearer <token>
Query Params: productName, productNote, hsnCode, productGroup, stockType
Response:
{
  "totalCount": 15,
  "productCount": 10,
  "serviceCount": 5
}



GENERATE BARCODE NUMBER MODULE
------------------------------

POST /barcode-generate/cart
Header: Authorization: Bearer <token>
Body: { "productId": "...", "noOfLabels": 10 }
Response: { "productId": "...", "productName": "...", "noOfLabels": 10, ... }

GET /barcode-generate/cart
Header: Authorization: Bearer <token>
Response: [ { "productId": "...", "productName": "...", "noOfLabels": 10, ... }, ... ]

DELETE /barcode-generate/cart/:id
Header: Authorization: Bearer <token>
Response: { "message": "Product removed from list" }

POST /barcode-generate/generate
Header: Authorization: Bearer <token>
Response: { 
  "userId": "...", 
  "items": [ 
    { "productId": "...", "productName": "...", "noOfLabels": 10, "generatedBarcodes": ["...", "..."] } 
  ], 
  "generatedAt": "..." 
}

GET /barcode-generate/history
Header: Authorization: Bearer <token>
Response: [ { ...history object... }, ... ]


BARCODE CUSTOMIZATION MODULE
----------------------------

POST /barcode/customization
Header: Authorization: Bearer <token>
Body: { 
  "productId": "...",
  "noOfLabels": 10,
  "customizationName": "My Layout",
  ... (all other fields)
}
Response: { ...customization... }

GET /barcode/customization
Header: Authorization: Bearer <token>
Response: [ { ... }, ... ]

GET /barcode/customization/:id
Header: Authorization: Bearer <token>
Response: { ... }

PUT /barcode/customization/:id
Header: Authorization: Bearer <token>
Body: { ...fields... }

DELETE /barcode/customization/:id
Header: Authorization: Bearer <token>
Response: { "message": "Customization removed" }


MANAGE STOCK MODULE
-------------------

GET /products/manage-stock?page=1&limit=10&search=pix&productGroup=Mobile&stockStatus=Negative Stock
Header: Authorization: Bearer <token>
Response: {
  "data": [
    {
      "_id": "65e...",
      "name": "Pixel 7",
      "productGroup": "Mobile",
      "purchasePrice": 40000,
      "sellPrice": 50000,
      "hsnCode": "8517",
      "currentStock": -2,
      "changeInStock": 0,
      "finalStock": -2,
      "remarks": ""
    }
  ],
  "pagination": { "total": 50, "page": 1, "pages": 5 }
}


SALE INVOICE MODULE
-------------------

POST /sale-invoice/create
Header: Authorization: Bearer <token>
Body: {
  "customerInformation": { "ms": "...", "placeOfSupply": "...", ... },
  "invoiceDetails": { "invoiceNumber": "...", "date": "...", ... },
  "items": [ { "productName": "...", "qty": 1, "price": 100, ... } ],
  "totals": { "grandTotal": 100, ... },
  "paymentType": "CASH", ...
  "shareOnEmail": true,
  "createDeliveryChallan": true
}
Response: { "success": true, "message": "Invoice saved successfully", "invoiceId": "...", "deliveryChallanId": "..." }

POST /sale-invoice/create-print
Header: Authorization: Bearer <token>
Body: { "shareOnEmail": true, "createDeliveryChallan": true, ... (same as /create) }
Response: { "success": true, "message": "Invoice saved successfully", "data": { ...complete invoice with deliveryChallanId... } }

GET /sale-invoice
Header: Authorization: Bearer <token>
Response: [ { ...invoice object... }, ... ]

GET /sale-invoice/:id
Header: Authorization: Bearer <token>
Response: { ...invoice object... }

DELETE /sale-invoice/:id
Header: Authorization: Bearer <token>
Response: { "success": true, "message": "Invoice deleted successfully" }

GET /sale-invoice/summary
Header: Authorization: Bearer <token>
Query Params: company, invoiceType, paymentType, fromDate, toDate
Response: { 
  "success": true, 
  "data": { 
    "totalTransactions": 10, 
    "totalCGST": 100, 
    "totalSGST": 100, 
    "totalIGST": 0, 
    "totalTaxable": 1000, 
    "totalValue": 1200 
  } 
}


VENDOR MODULE
-------------

POST /vendor/create
Header: Autho rization: Bearer <token>
Body: {
  "companyName": "...",
  "gstin": "...",
  "billingAddress": { "city": "...", "state": "...", "country": "..." },
  ...
}
Response: { "success": true, "data": { ...vendor object... } }

GET /vendor
Header: Authorization: Bearer <token>
Response: { "success": true, "data": [ ... ] }

GET /vendor/:id
Header: Authorization: Bearer <token>
Response: { "success": true, "data": { ...vendor... } }


CUSTOMER-VENDOR MODULE
----------------------

POST /customer-vendor/create
Header: Authorization: Bearer <token>
Body: { same fields as vendor }
Response: { "success": true, "message": "Record updated successfully", "data": { ... } }

GET /customer-vendor
Header: Authorization: Bearer <token>
Response: { "success": true, "data": [ ... ] }


PURCHASE INVOICE MODULE
-----------------------

POST /purchase-invoice/create
Header: Authorization: Bearer <token>
Body: {
  "vendorInformation": { "ms": "...", "placeOfSupply": "...", ... },
  "invoiceDetails": { "invoiceNumber": "...", "date": "...", ... },
  "items": [ { "productName": "...", "qty": 1, "price": 100, ... } ],
  "totals": { "grandTotal": 100, ... },
  "paymentType": "CASH", ...
  "shareOnEmail": true (optional)
}
Response: { "success": true, "message": "Invoice saved successfully", "invoiceId": "..." }

GET /purchase-invoice/summary
Header: Authorization: Bearer <token>
Response: { 
  "success": true, 
  "summary": { 
    "totalTransactions": 10, 
    "totalCGST": 500.00, 
    "totalSGST": 500.00, 
    "totalIGST": 0, 
    "totalTaxable": 5000.00, 
    "totalValue": 6000.00 
  },
  "data": [ { ...purchase invoice documents... } ]
}

GET /purchase-invoice
Header: Authorization: Bearer <token>
Response: { "success": true, "data": [ { "purchaseNo": "...", "companyName": "...", "purchaseDate": "...", "total": 0, "paymentType": "...", "outstanding": 0, "action": "..." } ] }

GET /purchase-invoice/search
Header: Authorization: Bearer <token>
Query Params: companyName, productName, fromDate, toDate, invoiceNumber, advancedFilters (encoded JSON), etc.
Response: Same as GET /purchase-invoice

POST /purchase-invoice/create-print
Header: Authorization: Bearer <token>
Body: { same as /create }
Response: { "success": true, "message": "Invoice saved successfully", "data": { ...complete invoice... } }
Note: Returns existing invoice if duplicate (vendor + invoice number + date) is found.

POST /purchase-invoice/upload-ai
Header: Authorization: Bearer <token>, Content-Type: multipart/form-data
Body: { "invoice": <PDF File> }
Response (Success): { "success": true, "extracted": true, "extractionId": "...", "data": { ...extracted fields... } }
Response (Missing Fields): { "success": true, "extracted": false, "message": "...", "missingFields": [...], "extractionId": "...", "confirmContinue": true }

POST /purchase-invoice/confirm-ai
Header: Authorization: Bearer <token>
Body: { "extractionId": "...", "continue": "Yes/No/true/false" }
Response (Yes): { "success": true, "message": "...", "data": { ...extracted fields... } }
Response (No): { "success": true, "message": "Extraction discarded" }

GET /purchase-invoice
Header: Authorization: Bearer <token>
Response: { "success": true, "data": [ { ...invoice object... }, ... ] }

GET /purchase-invoice/:id
Header: Authorization: Bearer <token>
Response: { "success": true, "data": { ...invoice object... } }

DELETE /purchase-invoice/:id
Header: Authorization: Bearer <token>
Response: { "success": true, "message": "Invoice deleted successfully" }

ADDITIONAL CHARGES MODULE
-------------------------

POST /additional-charges
Header: Authorization: Bearer <token>
Body: {
  "name": "Shipping",
  "productNote": "Fragile",
  "price": 100,
  "hsnSacCode": "9965",
  "noITC": false,
  "tax": 18,
  "isServiceItem": true
}
Response: 
{
  "success": true,
  "message": "Additional charge created successfully",
  "data": { ...additional charge object... }
}
Note: If duplicate (name + HSN/SAC code) exists, returns existing data with status 200.

GET /additional-charges
Header: Authorization: Bearer <token>
Response: 
{
  "success": true,
  "count": 1,
  "data": [ { ...additional charge object... }, ... ]
}

PURCHASE INVOICE CUSTOM FIELDS MODULE
-------------------------------------

POST /purchase-invoice/custom-fields
Header: Authorization: Bearer <token>
Body: {
  "fields": [
    {
      "name": "Warranty Period",
      "type": "TEXT",
      "status": "Active",
      "print": true,
      "required": false,
      "orderNo": 1
    },
    {
      "name": "Maintenance Type",
      "type": "DROPDOWN",
      "options": ["Annual", "One-time"],
      "status": "Active",
      "print": true,
      "required": true,
      "orderNo": 2
    }
  ]
}
Response:
{
  "success": true,
  "message": "Custom fields updated successfully",
  "data": [ ...list of saved fields... ]
}
Note: Replaces the entire list of custom fields for the user.

GET /purchase-invoice/custom-fields
Header: Authorization: Bearer <token>
Response:
{
  "success": true,
  "count": 2,
  "data": [ ...list of custom field objects... ]
}

PRODUCT CUSTOM COLUMNS MODULE
-----------------------------

POST /product/custom-columns
Header: Authorization: Bearer <token>
Body: {
  "customFieldName": "Shelf Number",
  "status": "Enabled",
  "print": true,
  "numericFormat": "None",
  "defaultValue": "A1",
  "position": "Before Quantity",
  "decimalValue": 0,
  "enableCalculation": false
}
Response:
{
  "success": true,
  "message": "Custom column saved successfully",
  "data": { ...saved custom column object... }
}
Note: Updates existing column if `customFieldName` exists for the user.

GET /product/custom-columns
Header: Authorization: Bearer <token>
Response:
{ 
  "success": true,
  "count": 1,
  "data": [ { ...custom column object... }, ... ]
}

## Membership & Subscription

### Membership Plans
`POST /api/setting-membership/seed-plans`
- **Desc**: Initialize default plans (FREE, 1Y, 3Y).
- **Response**: `{ "success": true, "data": [ { "name": "FREE", "durationYears": 0, "price": 0, ... }, ... ] }`

`GET /api/setting-membership/plans`
- **Desc**: Fetch all active membership plans.
- **Response**: 
```json
{
  "success": true,
  "data": [
    {
      "name": "PREMIUM",
      "durationYears": 1,
      "price": 4999,
      "gstPercentage": 18,
      "features": ["Unlimited Invoicing", "Multiple Staff Accounts"],
      "limits": { "docsPerYear": -1, "itemsPerDoc": -1, "staffAccounts": 5 }
    }
  ]
}
```

### User Membership
`GET /api/setting-membership/current`
- **Desc**: Fetch current user's membership details.
- **Response**:
```json
{
  "success": true,
  "data": {
    "membershipType": "PREMIUM",
    "expiryDate": "2027-01-03T00:00:00.000Z",
    "lastPaymentDate": "2026-01-03T11:00:00.000Z",
    "plan": { "name": "PREMIUM", "durationYears": 1, "price": 4999 }
  }
}
```

`POST /api/setting-membership/upgrade`
- **Desc**: Initiate an upgrade intent.
- **Body**: `{ "planId": "6595..." }`
- **Response**:
```json
{
  "success": true,
  "message": "Upgrade initiated",
  "plan": {
    "id": "6595...",
    "name": "PREMIUM",
    "durationYears": 3,
    "totalAmount": 14159,
    "gst": 18
  }
}
```

### Payment History
`GET /api/setting-membership/payments`
- **Desc**: Fetch payment history.
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "paymentFor": "PREMIUM 1-Year",
      "paymentDate": "2026-01-03T11:00:00.000Z",
      "amount": 5899,
      "transactionId": "TXN123456",
      "paymentType": "ONLINE"
    }
  ]
}
```

## Credit Settings

### Credit Balance
`GET /api/setting-credit/balance`
- **Desc**: Fetch current user credit balance and remaining credits.
- **Response**:
```json
{
  "success": true,
  "data": {
    "totalCredits": 100,
    "usedCredits": 20,
    "remainingCredits": 80,
    "packName": "100 Credits"
  }
}
```

### Available Credit Packs
`GET /api/setting-credit/packs`
- **Desc**: Fetch all active credit packs for purchase.
- **Response**:
```json
{
  "success": true,
  "data": [
    { "_id": "...", "name": "100 Credits", "credits": 100, "price": 500, "gstPercentage": 18 }
  ]
}
```

### Purchase Credits
`POST /api/setting-credit/purchase`
- **Desc**: Purchase a credit pack.
- **Body**: `{ "packId": "...", "transactionId": "...", "paymentType": "ONLINE" }`
- **Response**: `{ "success": true, "message": "Credits purchased successfully", "data": { ...updated balance... } }`

### Credit Usage Logs
`GET /api/setting-credit/logs`
- **Desc**: Fetch transaction history for credit usage and additions.
- **Response**:
```json
{
  "success": true,
  "data": [
    { "type": "DEBIT", "action": "E-Way Bill Generate", "credits": 1, "balanceAfter": 79, "createdAt": "..." }
  ]
}
```

### Credit Payment History
`GET /api/setting-credit/payments`
- **Desc**: Fetch payment logs for credit pack purchases.
- **Response**:
```json
{
  "success": true,
  "data": [
    { "packName": "100 Credits", "amount": 590, "transactionId": "TXN...", "paymentType": "ONLINE", "paymentDate": "..." }
  ]
}
```

### Internal Initialization
`POST /api/setting-credit/seed`
- **Desc**: Seed default credit packs and usage rules.


## Login & Security Settings

### Request Phone Change OTP
`POST /api/setting-security/request-phone-change-otp`
- **Desc**: Send OTP to the new phone number to initiate change.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "newPhone": "9876543210" }`
- **Response**:
```json
{
  "success": true,
  "message": "OTP sent to new phone number",
  "data": {
    "phone": "9876543210",
    "otp": "123456"
  }
}
```

### Verify Phone Change OTP
`POST /api/setting-security/verify-phone-change-otp`
- **Desc**: Verify OTP and replace the current primary phone number.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "newPhone": "9876543210", "otp": "123456" }`
- **Response**:
```json
{
  "success": true,
  "message": "Phone number updated successfully",
  "data": {
    "_id": "659...",
    "phone": "9876543210",
    "userId": "GSTBILL123456",
    ...
  }
}
```

### Request Email Change OTP
`POST /api/setting-security/request-email-change-otp`
- **Desc**: Send OTP to the new email address to initiate change.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "newEmail": "user@example.com" }`
- **Response**:
```json
{
  "success": true,
  "message": "OTP sent to new email address",
  "data": {
    "email": "user@example.com",
    "otp": "123456"
  }
}
```

### Verify Email Change OTP
`POST /api/setting-security/verify-email-change-otp`
- **Desc**: Verify OTP and replace the current email address.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "newEmail": "user@gmail.com", "otp": "123456" }`
- **Response**:
```json
{
  "success": true,
  "message": "Email address updated successfully",
  "data": {
    "_id": "659...",
    "email": "user@gmail.com",
    "userId": "GSTBILL123456",
    ...
  }
}
```

### Request Credentials OTP
`POST /api/setting-security/request-credentials-otp`
- **Desc**: Send OTP to the registered phone number to verify identity before updating User ID & Password.
- **Header**: `Authorization: Bearer <token>`
- **Body**: 
```json
{ 
  "userId": "newuser123", 
  "password": "Password@123", 
  "confirmPassword": "Password@123" 
}
```
- **Response**:
```json
{
  "success": true,
  "message": "OTP sent to your registered phone number",
  "data": {
    "phone": "9876543210",
    "otp": "123456"
  }
}
```

### Verify Credentials OTP
`POST /api/setting-security/verify-credentials-otp`
- **Desc**: Verify OTP and update User ID and insecurely store hashed password.
- **Header**: `Authorization: Bearer <token>`
- **Body**: 
```json
{ 
  "otp": "123456",
  "userId": "newuser123", 
  "password": "Password@123"
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Credentials updated successfully",
  "data": {
    "_id": "659...",
    "phone": "9876543210",
    "userId": "newuser123",
    ...
  }
}
```

### Add Dispatch Address
`POST /api/setting-security/dispatch-address`
- **Desc**: Add a new dispatch from address to the user's business profile.
- **Header**: `Authorization: Bearer <token>`
- **Body**: 
```json
{
  "gstNumber": "...",
  "gstAutoFill": true,
  "companyName": "My Branch",
  "name": "John Doe",
  "phone": "9876543210",
  "email": "branch@example.com",
  "addressLine1": "123 Street",
  "landmark": "Near Park",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "country": "India"
}
```
- **Response**: `{ "success": true, "message": "Dispatch address added successfully", "data": { ...savedAddress } }`

### Get Dispatch Addresses
`GET /api/setting-security/dispatch-addresses`
- **Desc**: Fetch all dispatch addresses for the authenticated user.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "...", "data": [ { ...address1 }, { ...address2 } ] }`

### GSTIN Auto-Fill for Dispatch Address
`GET /api/setting-security/gst-autofill-dispatch`
- **Desc**: Fetch the authenticated user's Business Profile data (GSTIN, Company Name, Address, City, State, Pincode) to pre-fill the Dispatch From Address form.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "GSTIN data fetched successfully",
  "data": {
    "gstNumber": "27ABCDE1234F1Z5",
    "companyName": "My Business",
    "address": "123 Business Lane",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400001"
  }
}
```
*Note: Validates GSTIN format (15 characters) and existence before returning data.*

### Get Business Profile
`GET /api/setting-security/business-profile`
- **Desc**: Fetch current business profile details.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "...", "data": { "gstNumber": "...", "companyName": "locked", "fullName": "locked", "displayPhone": "locked", ... } }`

### Request Business Profile OTP
`POST /api/setting-security/request-business-profile-otp`
- **Desc**: Send a static OTP to the registered phone for profile update verification.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "OTP sent...", "data": { "phone": "...", "otp": "123456" } }`

### Verify & Update Business Profile
`POST /api/setting-security/verify-business-profile-otp`
- **Desc**: Verify OTP and update business profile fields. Non-editable fields like Company Name are preserved.
- **Header**: `Authorization: Bearer <token>`
- **Body**: 
```json
{
  "otp": "123456",
  "gstNumber": "...",
  "pan": "...",
  "companyType": "Private Limited",
  "address": "...",
  "landmark": "...",
  "pincode": "...",
  "city": "...",
  "state": "...",
  "additionalLicense": "...",
  "lutNo": "...",
  "iecNo": "...",
  "website": "...",
  "gstAutoFill": true,
  "updateGstOnPreviousInvoices": false
}
```
- **Response**: `{ "success": true, "message": "Business profile updated successfully", "data": { ...updatedProfile } }`

### Toggle E-Invoice Setting
`POST /api/setting-security/toggle-einvoice`
- **Desc**: Enable or disable E-Invoice daily processing for the user.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "enabled": true }`
- **Response**: `{ "success": true, "message": "...", "data": { "eInvoiceEnabled": true } }`

### Get E-Invoice Setting
`GET /api/setting-security/einvoice-setting`
- **Desc**: Fetch the current E-Invoice Enable/Disable state.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "...", "data": { "eInvoiceEnabled": false } }`

### Update E-Way Bill Credentials
`POST /api/setting-security/update-eway-credentials`
- **Desc**: Update E-Way Bill & E-Invoice Credentials (User ID and Password). Requires primary account credentials for authorization.
- **Header**: `Authorization: Bearer <token>`
- **Body**: 
```json
{ 
  "userId": "primary_userid", 
  "password": "primary_password", 
  "ewayBillUserId": "eway_user_id", 
  "ewayBillPassword": "eway_password" 
}
```
- **Response**: 
```json
{
  "success": true,
  "message": "E-Way Bill & E-Invoice credentials updated successfully",
  "data": {
    "userId": "primary_userid",
    "ewayBillUserId": "eway_user_id",
    "gstNumber": "..."
  }
}
```
*Note: Securely validates primary User ID and Password before updating E-Way details. Both E-Way Bill User ID and hashed Password are persisted.*

---

## Staff Management
Manage staff accounts linked to the owner business.

### Create Staff Account
`POST /api/staff/create`
- **Desc**: Create a new staff account linked to the authenticated owner.
- **Header**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "userId": "staff001",
  "fullName": "Jane Smith",
  "phone": "9876543210",
  "email": "jane@example.com",
  "password": "staffPassword123",
  "confirmPassword": "staffPassword123",
  "isEnabled": true,
  "activeHours": "9 AM - 6 PM",
  "allowedSections": ["Sales", "Inventory"]
}
```
- **Response**: `{ "success": true, "message": "Staff account created successfully", "data": { ...staffDetails } }`

### Fetch Staff by Name
`GET /api/staff/search/:name`
- **Desc**: Fetch a single staff member's details by their `fullName` (case-insensitive).
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "...", "data": { ...staffDetails } }`

### Fetch All Staff
`GET /api/staff/all`
- **Desc**: Fetch all staff accounts created by the authenticated owner.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "...", "data": [ { ...staff1 }, { ...staff2 } ] }`

### Update Security Settings
`POST /api/setting-security/update-settings`
- **Desc**: Update security preferences like location tracking.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "trackLoginLocation": true }`
- **Response**: `{ "success": true, "message": "...", "data": { "trackLoginLocation": true } }`

### Login History & Active Sessions
`GET /api/setting-security/history`
- **Desc**: Fetch active logged-in devices and full login history.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "Login history fetched successfully",
  "data": {
    "activeDevices": [
      {
        "_id": "65af...",
        "device": "Desktop",
        "browser": "Chrome",
        "platform": "Windows",
        "ip": "127.0.0.1",
        "location": "India, Maharashtra, Mumbai (IP: 127.0.0.1)",
        "loginTime": "2026-01-04T10:00:00.000Z",
        "isActive": true
      }
    ],
    "loginLog": [
      { ...same structure as activeDevices... }
    ]
  }
}
```
*Note: `location` is omitted if `trackLoginLocation` is disabled.*

### Logout All Devices
`POST /api/setting-security/logout-all`
- **Desc**: Invalidate all active sessions for the user.
- **Header**: `Authorization: Bearer <token>`
- **Response**: `{ "success": true, "message": "Logged out from all devices successfully", "data": null }`

---

## Go Drive
Unified search for products, invoices, expenses, and documents.

### Search Drive Documents
`GET /api/go-drive/search`
- **Desc**: Search stored records by reference type and custom date range. Supports "Search All" to bypass date filtering.
- **Header**: `Authorization: Bearer <token>`
- **Query Params**:
  - `referenceType` (Required): `product`, `purchase_invoice`, `daily_expense`, or `letter`.
  - `fromDate`: Start date (YYYY-MM-DD).
  - `toDate`: End date (YYYY-MM-DD).
  - `searchAll`: Set to `true` to fetch all records for the type regardless of date.
- **Response**:
```json
{
  "success": true,
  "message": "purchase invoice records fetched successfully",
  "total": 5,
  "data": [ ...list of records... ]
}
```
*Note: Logic ensures data is isolated per authenticated user.*

---

## Digital Signature (Beta)
Manage digital signer certificates for documents.

### Upload Certificate
`POST /api/setting-digital-signature/upload`
- **Desc**: Upload a .pfx signer certificate with a password. Only one active certificate per user is allowed.
- **Header**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Body (form-data)**:
  - `pfxFile` (File): The `.pfx` file.
  - `password` (String): Password for the certificate.
- **Response**: `{ "success": true, "message": "...", "data": { "fileName": "...", "uploadDate": "...", "isEnabled": true } }`

### Toggle Digital Signature
`POST /api/setting-digital-signature/toggle`
- **Desc**: Enable or disable the digital signature functionality.
- **Header**: `Authorization: Bearer <token>`
- **Body**: `{ "enabled": true }`
- **Response**: `{ "success": true, "message": "...", "data": { "isEnabled": true } }`

### Get Digital Signature Status
`GET /api/setting-digital-signature/status`
- **Desc**: Fetch current certificate metadata and status.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "...",
  "data": {
    "fileName": "cert.pfx",
    "uploadDate": "2026-01-04T...",
    "isEnabled": true
  }
}
```

---

## Activity Log
Track user and staff actions across modules.

### Fetch Activity Logs
`GET /api/activity-logs`
- **Desc**: Retrieve a list of activity logs with advanced filtering.
- **Header**: `Authorization: Bearer <token>`
- **Query Params**:
  - `staffId`: Filter by a specific staff member's ID.
  - `search`: Text search on description or reference number.
  - `action`: Filter by action type (`Insert`, `Update`, `Delete`).
  - `module`: Filter by module name (e.g., `Product`, `Purchase Invoice`, `Organisation Detail`, `Company`).
  - `startDate`: Start date for range filtering (YYYY-MM-DD).
  - `endDate`: End date for range filtering (YYYY-MM-DD).
  - `showAll`: Set to `true` to fetch all logs without date range restrictions.
- **Response**:
```json
{
  "success": true,
  "message": "Activity logs fetched successfully",
  "total": 25,
  "data": [
    {
      "_id": "65af...",
      "staffId": { "_id": "...", "fullName": "John Doe", "userId": "staff01" },
      "action": "Update",
      "module": "Product",
      "refNo": "BARCODE123",
      "description": "Product updated: iPhone 15",
      "timestamp": "2026-01-04T15:00:00.000Z"
    }
  ]
}
```
*Note: Logs are automatically generated during create/update/delete operations in supported modules.*

---

## General Settings
System-wide preferences, document templates, and company branding.

### Fetch General Settings
`GET /api/general-settings`
- **Desc**: Retrieve all UI preferences, numeric formats, and image paths for the company.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "General settings fetched successfully",
  "data": {
    "enableRounding": true,
    "recordsPerPage": 10,
    "dateFormat": "DD/MM/YYYY",
    "logoPath": "uploads/settings/logo-123.png",
    ...
  }
}
```

### Update Settings
`POST /api/general-settings/update`
- **Desc**: Update toggles, numeric fields, enums, and text fields.
- **Header**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "enableRounding": true,
  "recordsPerPage": 20,
  "dateFormat": "DD/MM/YYYY",
  "discountType": "Percentage",
  "roundOffType": "Normal",
  "billOfSupplyTitle": "Bill of Supply",
  "defaultNotes": "Thank you for your business!"
}
```
- **Response**: `{ "success": true, "message": "General settings updated successfully", "data": { ...updatedSettings } }`

### Upload Branding Images
`POST /api/general-settings/upload-images`
- **Desc**: Upload or replace company logo, signature, invoice background, or footer images.
- **Header**: `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
- **Body (form-data)**:
  - `logo` (File): Company logo image.
  - `signature` (File): Authorized signatory image.
  - `background` (File): Invoice background image.
  - `footer` (File): Invoice footer image.
- **Response**: `{ "success": true, "message": "Images uploaded successfully", "data": { "logoPath": "...", "signaturePath": "...", ... } }`
- **Note**: Accepts .jpg, .jpeg, .png only. Max size 2MB per file.


---

## Product & Stock Options Settings
Manage product fields, stock behavior, serial numbers, batch settings, and barcode scanning preferences.

### Fetch Product & Stock Settings
`GET /api/product-stock-settings`
- **Desc**: Retrieve all product and stock configuration settings for the logged-in user.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "Settings retrieved successfully",
  "data": {
    "userId": "659...",
    "productOptions": {
      "mrp": {
        "status": true,
        "required": false,
        "print": true,
        "allowDuplicate": true
      },
      "productCode": {
        "status": true,
        "required": false,
        "print": true,
        "allowDuplicate": false
      },
      "barcodeNo": {
        "status": true,
        "required": false,
        "print": true,
        "allowDuplicate": false
      },
      "enableSearchByAnyWord": true
    },
    "stockOptions": {
      "allowSalesWithoutStock": false,
      "hideOutOfStockProducts": false,
      "hideOutOfStockBatches": false
    },
    "serialNumberSettings": {
      "fieldName": "Serial Number",
      "strictMode": false,
      "applicableDocuments": {
        "quotation": false,
        "proformaInvoice": false,
        "saleOrder": false,
        "deliveryChallan": false
      }
    },
    "batchSettings": {
      "batchNo": {
        "type": "text",
        "status": true,
        "required": false,
        "print": true,
        "inputOption": "text"
      },
      "modelNo": {
        "type": "text",
        "status": false,
        "required": false,
        "print": false,
        "inputOption": "text"
      },
      "size": {
        "type": "text",
        "status": false,
        "required": false,
        "print": false,
        "inputOption": "text"
      },
      "mfgDate": {
        "type": "date",
        "status": false,
        "required": false,
        "print": false,
        "inputOption": "date"
      },
      "expiryDate": {
        "type": "date",
        "status": false,
        "required": false,
        "print": false,
        "inputOption": "date"
      }
    },
    "batchOptionsForDocuments": {
      "quotation": false,
      "proformaInvoice": false,
      "deliveryChallan": false,
      "purchaseOrder": false,
      "saleOrder": false,
      "jobWork": false
    },
    "barcodeOptions": {
      "minimumBarcodeScanLength": 3,
      "focusAfterScan": "quantity",
      "alwaysAddNewRowOnScan": false
    },
    "createdAt": "2026-01-05T03:30:00.000Z",
    "updatedAt": "2026-01-05T03:30:00.000Z"
  }
}
```
- **Note**: If no settings exist, returns default values with `"message": "No settings found, returning defaults"`.

### Save or Update Settings
`POST /api/product-stock-settings`
- **Desc**: Save new settings or update existing configuration for the logged-in user.
- **Header**: `Authorization: Bearer <token>`
- **Body** (all fields optional, send only what needs to be updated):
```json
{
  "productOptions": {
    "mrp": {
      "status": true,
      "required": true,
      "print": true,
      "allowDuplicate": false
    },
    "productCode": {
      "status": true,
      "required": true,
      "print": true,
      "allowDuplicate": false
    },
    "barcodeNo": {
      "status": true,
      "required": false,
      "print": true,
      "allowDuplicate": false
    },
    "enableSearchByAnyWord": true
  },
  "stockOptions": {
    "allowSalesWithoutStock": true,
    "hideOutOfStockProducts": false,
    "hideOutOfStockBatches": true
  },
  "serialNumberSettings": {
    "fieldName": "Serial No",
    "strictMode": true,
    "applicableDocuments": {
      "quotation": true,
      "proformaInvoice": true,
      "saleOrder": true,
      "deliveryChallan": true
    }
  },
  "batchSettings": {
    "batchNo": {
      "type": "text",
      "status": true,
      "required": true,
      "print": true,
      "inputOption": "text"
    },
    "modelNo": {
      "type": "text",
      "status": true,
      "required": false,
      "print": true,
      "inputOption": "text"
    },
    "size": {
      "type": "number",
      "status": true,
      "required": false,
      "print": false,
      "inputOption": "text"
    },
    "mfgDate": {
      "type": "date",
      "status": true,
      "required": false,
      "print": true,
      "inputOption": "month"
    },
    "expiryDate": {
      "type": "date",
      "status": true,
      "required": true,
      "print": true,
      "inputOption": "date"
    }
  },
  "batchOptionsForDocuments": {
    "quotation": true,
    "proformaInvoice": true,
    "deliveryChallan": true,
    "purchaseOrder": false,
    "saleOrder": true,
    "jobWork": false
  },
  "barcodeOptions": {
    "minimumBarcodeScanLength": 5,
    "focusAfterScan": "next_row",
    "alwaysAddNewRowOnScan": true
  }
}
```
- **Response (Create)**:
```json
{
  "success": true,
  "message": "Product & Stock settings saved successfully",
  "data": {
    "_id": "65af...",
    "userId": "659...",
    "productOptions": { ... },
    "stockOptions": { ... },
    "serialNumberSettings": { ... },
    "batchSettings": { ... },
    "batchOptionsForDocuments": { ... },
    "barcodeOptions": { ... },
    "createdAt": "2026-01-05T03:30:00.000Z",
    "updatedAt": "2026-01-05T03:30:00.000Z"
  }
}
```
- **Response (Update)**:
```json
{
  "success": true,
  "message": "Product & Stock settings updated successfully",
  "data": { ...updated settings... }
}
```

#### Field Constraints:
- **productOptions**: Each field (mrp, productCode, barcodeNo) has `status`, `required`, `print`, `allowDuplicate` flags.
- **stockOptions**: Boolean flags for sales and stock visibility behavior.
- **serialNumberSettings.fieldName**: Custom label for serial number field.
- **serialNumberSettings.strictMode**: Enforce strict serial number validation.
- **serialNumberSettings.applicableDocuments**: Enable serial numbers for specific document types.
- **batchSettings**: Each field (batchNo, modelNo, size, mfgDate, expiryDate) has:
  - `type`: Enum `['text', 'number', 'date']`
  - `status`: Boolean (enabled/disabled)
  - `required`: Boolean (mandatory field)
  - `print`: Boolean (show on print)
  - `inputOption`: Enum `['text', 'date', 'month']`
- **batchOptionsForDocuments**: Enable batch fields for quotation, proforma invoice, delivery challan, purchase order, sale order, job work.
- **barcodeOptions.minimumBarcodeScanLength**: Integer (1-50), minimum characters for barcode scan.
- **barcodeOptions.focusAfterScan**: Enum `['quantity', 'rate', 'discount', 'next_row', 'barcode']`, where to focus after scanning.
- **barcodeOptions.alwaysAddNewRowOnScan**: Boolean, auto-add new row on each scan.

#### Validation Errors:
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "barcodeOptions.minimumBarcodeScanLength must be between 1 and 50",
    "batchSettings.batchNo.type must be one of: text, number, date"
  ]
}
```


---

## Print Template Settings
Manage print template configurations for each document type per branch. Users can select templates, configure print size and orientation for standard templates.

### Get Document Types
`GET /api/print-template-settings/document-types`
- **Desc**: Retrieve all available document types for template configuration.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "Document types retrieved successfully",
  "data": [
    { "documentType": "Sale Invoice", "displayName": "Sale Invoice" },
    { "documentType": "Delivery Challan", "displayName": "Delivery Challan" },
    { "documentType": "Quotation", "displayName": "Quotation" },
    { "documentType": "Proforma", "displayName": "Proforma" },
    { "documentType": "Purchase Order", "displayName": "Purchase Order" },
    { "documentType": "Sale Order", "displayName": "Sale Order" },
    { "documentType": "Job Work", "displayName": "Job Work" },
    { "documentType": "Credit Note", "displayName": "Credit Note" },
    { "documentType": "Debit Note", "displayName": "Debit Note" },
    { "documentType": "Purchase Invoice", "displayName": "Purchase Invoice" },
    { "documentType": "Multi Currency Invoice", "displayName": "Multi Currency Invoice" },
    { "documentType": "Payment Receipt", "displayName": "Payment Receipt" },
    { "documentType": "Daily Expense", "displayName": "Daily Expense" },
    { "documentType": "Other Income", "displayName": "Other Income" },
    { "documentType": "Letters", "displayName": "Letters" },
    { "documentType": "Packing List", "displayName": "Packing List" }
  ]
}
```

### Get Available Templates
`GET /api/print-template-settings/templates`
- **Desc**: Retrieve all available templates with their categories and print settings support.
- **Header**: `Authorization: Bearer <token>`
- **Response**:
```json
{
  "success": true,
  "message": "Templates retrieved successfully",
  "data": [
    { "name": "Default", "category": "standard", "supportsPrintSettings": true },
    { "name": "Designed", "category": "standard", "supportsPrintSettings": true },
    { "name": "Letterpad", "category": "standard", "supportsPrintSettings": true },
    { "name": "Template-1", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-2", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-3", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-4", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-5", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-6", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-7", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-8", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-9", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-10", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-11", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-12", "category": "custom", "supportsPrintSettings": false },
    { "name": "Template-13", "category": "custom", "supportsPrintSettings": false },
    { "name": "A5-Default", "category": "a5", "supportsPrintSettings": false },
    { "name": "A5-Designed", "category": "a5", "supportsPrintSettings": false },
    { "name": "A5-Letterpad", "category": "a5", "supportsPrintSettings": false },
    { "name": "Thermal-2inch", "category": "thermal", "supportsPrintSettings": false },
    { "name": "Thermal-3inch", "category": "thermal", "supportsPrintSettings": false }
  ]
}
```
- **Note**: `supportsPrintSettings: true` indicates the template accepts `printSize` and `printOrientation`. A5 and Thermal templates have predefined sizes.

### Get Template Settings
`GET /api/print-template-settings?branchId=main`
- **Desc**: Retrieve saved template configurations for all document types for a specific branch.
- **Header**: `Authorization: Bearer <token>`
- **Query Params**: 
  - `branchId` (optional): Branch identifier, defaults to `"main"`
- **Response (Saved Settings)**:
```json
{
  "success": true,
  "message": "Template settings retrieved successfully",
  "data": {
    "_id": "65af...",
    "userId": "659...",
    "branchId": "main",
    "templateConfigurations": [
      {
        "documentType": "Sale Invoice",
        "selectedTemplate": "Designed",
        "printSize": "A4",
        "printOrientation": "Portrait"
      },
      {
        "documentType": "Delivery Challan",
        "selectedTemplate": "A5-Default",
        "printSize": null,
        "printOrientation": null
      },
      {
        "documentType": "Quotation",
        "selectedTemplate": "Template-5",
        "printSize": null,
        "printOrientation": null
      }
    ],
    "createdAt": "2026-01-05T04:00:00.000Z",
    "updatedAt": "2026-01-05T04:15:00.000Z"
  }
}
```
- **Response (No Saved Settings - Defaults)**:
```json
{
  "success": true,
  "message": "No saved settings found, returning defaults",
  "data": {
    "userId": "659...",
    "branchId": "main",
    "templateConfigurations": [
      {
        "documentType": "Sale Invoice",
        "selectedTemplate": "Default",
        "printSize": "A4",
        "printOrientation": "Portrait"
      },
      {
        "documentType": "Delivery Challan",
        "selectedTemplate": "Default",
        "printSize": "A4",
        "printOrientation": "Portrait"
      }
      // ... all document types with Default template
    ]
  }
}
```

### Get Document Template Configuration
`GET /api/print-template-settings/document/Sale%20Invoice?branchId=main`
- **Desc**: Retrieve template configuration for a specific document type.
- **Header**: `Authorization: Bearer <token>`
- **URL Params**: `documentType` - Document type name (URL encoded)
- **Query Params**: `branchId` (optional) - Branch identifier
- **Response (Saved)**:
```json
{
  "success": true,
  "message": "Template configuration retrieved successfully",
  "data": {
    "documentType": "Sale Invoice",
    "selectedTemplate": "Designed",
    "printSize": "A4",
    "printOrientation": "Landscape"
  }
}
```
- **Response (Default)**:
```json
{
  "success": true,
  "message": "No configuration found for this document type, returning default",
  "data": {
    "documentType": "Sale Invoice",
    "selectedTemplate": "Default",
    "printSize": "A4",
    "printOrientation": "Portrait"
  }
}
```

### Save or Update Template Settings
`POST /api/print-template-settings`
- **Desc**: Save or update template selections for multiple document types. Supports partial updates.
- **Header**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "branchId": "main",
  "templateConfigurations": [
    {
      "documentType": "Sale Invoice",
      "selectedTemplate": "Designed",
      "printSize": "A4",
      "printOrientation": "Landscape"
    },
    {
      "documentType": "Delivery Challan",
      "selectedTemplate": "A5-Default"
    },
    {
      "documentType": "Quotation",
      "selectedTemplate": "Thermal-3inch"
    },
    {
      "documentType": "Purchase Invoice",
      "selectedTemplate": "Template-7"
    },
    {
      "documentType": "Credit Note",
      "selectedTemplate": "Letterpad",
      "printSize": "Letter",
      "printOrientation": "Portrait"
    }
  ]
}
```
- **Response (Create)**:
```json
{
  "success": true,
  "message": "Template settings saved successfully",
  "data": {
    "_id": "65af...",
    "userId": "659...",
    "branchId": "main",
    "templateConfigurations": [
      {
        "documentType": "Sale Invoice",
        "selectedTemplate": "Designed",
        "printSize": "A4",
        "printOrientation": "Landscape"
      },
      {
        "documentType": "Delivery Challan",
        "selectedTemplate": "A5-Default",
        "printSize": null,
        "printOrientation": null
      }
      // ... all configurations
    ],
    "createdAt": "2026-01-05T04:15:00.000Z",
    "updatedAt": "2026-01-05T04:15:00.000Z"
  }
}
```
- **Response (Update)**:
```json
{
  "success": true,
  "message": "Template settings updated successfully",
  "data": { ...updated settings... }
}
```

#### Field Constraints:
- **branchId**: Optional, defaults to `"main"`. Allows multi-branch template configurations.
- **templateConfigurations**: Array of configuration objects, each must have:
  - `documentType`: Must be one of the valid document types
  - `selectedTemplate`: Must be one of the available templates
  - `printSize`: Only for standard templates (Default, Designed, Letterpad). Enum: `['A4', 'A5', 'Letter']`
  - `printOrientation`: Only for standard templates. Enum: `['Portrait', 'Landscape']`
- **A5 and Thermal Templates**: Cannot have `printSize` or `printOrientation` (predefined)
- **Custom Templates (Template-1 to Template-13)**: Cannot have `printSize` or `printOrientation`

#### Validation Errors:
```json
{
  "success": false,
  "message": "Template \"A5-Default\" does not support print size or orientation settings"
}
```
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    "templateConfigurations.0.documentType: `Invalid Type` is not a valid enum value",
    "templateConfigurations.1.selectedTemplate: `CustomTemplate` is not a valid enum value"
  ]
}
```

#### Usage Notes:
1. **Default Selection**: If no settings exist, all document types default to "Default" template with A4 Portrait.
2. **Partial Updates**: You can send configurations for only the document types you want to update. The entire `templateConfigurations` array replaces the existing one.
3. **Multi-Branch Support**: Use different `branchId` values to maintain separate template configurations per branch.
4. **Template Categories**:
   - **Standard** (Default, Designed, Letterpad): Support custom print size and orientation
   - **Custom** (Template-1 to Template-13): Predefined layouts, no size/orientation options
   - **A5** (A5-Default, A5-Designed, A5-Letterpad): Fixed A5 size
   - **Thermal** (Thermal-2inch, Thermal-3inch): Fixed thermal printer sizes


---

## Print Options
Save flexible print configuration settings with optional nested objects. All fields are optional, supports partial updates, and preserves existing values.

### Save Print Options
`POST /api/print-options`
- **Desc**: Save or update print configuration settings. Accepts empty payload, all fields optional, smart merge preserves existing values.
- **Header**: `Authorization: Bearer <token>`
- **Body** (all fields optional):
```json
{
  "headerPrintSettings": {
    "showLogo": true,
    "showCompanyName": true,
    "showAddress": false,
    "logoSize": "medium",
    "headerHeight": 100
  },
  "customerDocumentPrintSettings": {
    "showCustomerName": true,
    "showBillingAddress": true,
    "showShippingAddress": false,
    "showGSTIN": true,
    "showContactDetails": true
  },
  "productItemSettings": {
    "showProductCode": true,
    "showHSNCode": true,
    "showQuantity": true,
    "showRate": true,
    "showDiscount": false,
    "showTax": true,
    "showAmount": true,
    "columnOrder": ["name", "code", "hsn", "qty", "rate", "tax", "amount"]
  },
  "footerPrintSettings": {
    "showTermsAndConditions": true,
    "showBankDetails": true,
    "showSignature": true,
    "showDeclaration": false,
    "footerText": "Thank you for your business"
  },
  "documentPrintSettings": {
    "showInvoiceNumber": true,
    "showDate": true,
    "showDueDate": false,
    "showPaymentType": true,
    "fontSize": 12,
    "lineSpacing": 1.5
  },
  "packingListPrintSettings": {
    "showPackingDetails": true,
    "showWeight": false,
    "showDimensions": false,
    "showPackageCount": true
  }
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Print options saved successfully"
}
```

#### Empty Payload (Valid)
```json
POST /api/print-options
Body: {}

Response:
{
  "success": true,
  "message": "Print options saved successfully"
}
```

#### Partial Update Example
```json
POST /api/print-options
Body: {
  "headerPrintSettings": {
    "showLogo": false
  }
}

Response:
{
  "success": true,
  "message": "Print options saved successfully"
}
```
- **Note**: Only `showLogo` is updated. All other existing settings in `headerPrintSettings` and other sections remain unchanged.

#### Nested Object Update
```json
POST /api/print-options
Body: {
  "productItemSettings": {
    "showDiscount": true,
    "columnOrder": ["name", "qty", "rate", "discount", "amount"]
  },
  "footerPrintSettings": {
    "showBankDetails": false
  }
}

Response:
{
  "success": true,
  "message": "Print options saved successfully"
}
```
- **Note**: Updates specific fields in `productItemSettings` and `footerPrintSettings` while preserving all other settings.

#### Field Types Supported
- **Boolean**: `true`, `false`
- **String**: Any text value
- **Number**: Integer or decimal
- **Null**: Explicitly set field to `null`
- **Array**: Lists of values
- **Nested Objects**: Any depth of nesting

#### Key Features:
1. **No Required Fields**: All fields are optional, API accepts empty `{}` payload
2. **Smart Merge**: Only updates provided fields, preserves existing values
3. **Partial Updates**: Send only the fields you want to change
4. **Flexible Structure**: Supports any nested object structure
5. **User-Specific**: Settings stored per `userId` from JWT token
6. **No Validation Errors**: Accepts any valid JSON structure

#### Usage Notes:
- First save creates new settings with provided values
- Subsequent saves merge new values with existing settings
- Missing keys in payload do not delete existing values
- To remove a value, explicitly set it to `null`
- Nested objects are merged at the first level
- Arrays are replaced entirely (not merged)


---

## Bank Details
Save and manage multiple bank accounts per user with comprehensive validation for Indian banking standards.

### Save Bank Details
`POST /api/bank-details`
- **Desc**: Save or update bank account details. Supports multiple accounts per user. Each account has a unique `bank_id`.
- **Header**: `Authorization: Bearer <token>`
- **Body**:
```json
{
  "bankId": "optional-for-update",
  "accountName": "John Doe",
  "bankName": "State Bank of India",
  "ifscCode": "SBIN0001234",
  "swiftCode": "SBININBB123",
  "micrCode": "400002001",
  "accountNumber": "12345678901234",
  "branchName": "Mumbai Main Branch",
  "upiId": "john@paytm",
  "printUpiQrOnInvoice": true,
  "upiQrOnInvoiceWithAmount": false
}
```
- **Response (Create)**:
```json
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "bankId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```
- **Response (Update)**:
```json
{
  "success": true,
  "message": "Bank details updated successfully"
}
```

#### Field Descriptions:
- **bankId** (optional): Provide to update existing bank account, omit to create new
- **accountName** (required): Account holder name
- **bankName** (required): Name of the bank
- **ifscCode** (optional): Indian IFSC code, validated format
- **swiftCode** (optional): International SWIFT code, validated format
- **micrCode** (optional): MICR code (9 digits)
- **accountNumber** (required): Bank account number
- **branchName** (optional): Bank branch name
- **upiId** (optional): UPI ID, validated format
- **printUpiQrOnInvoice** (optional): Boolean, print UPI QR on invoice
- **upiQrOnInvoiceWithAmount** (optional): Boolean, include amount in QR

#### Validation Rules:

**Required Fields:**
- `accountName`: Non-empty string
- `bankName`: Non-empty string
- `accountNumber`: Non-empty string

**Format Validation (when provided):**
- **IFSC Code**: Must match `^[A-Z]{4}0[A-Z0-9]{6}$`
  - Example: `SBIN0001234`, `HDFC0000123`
- **UPI ID**: Must match `^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$`
  - Example: `john@paytm`, `user.name@oksbi`, `9876543210@ybl`
- **SWIFT Code**: Must match `^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$`
  - Example: `SBININBB`, `SBININBB123`
- **MICR Code**: Must be exactly 9 digits
  - Example: `400002001`, `110002001`

#### Create New Bank Account
```json
POST /api/bank-details
Body: {
  "accountName": "Jane Smith",
  "bankName": "HDFC Bank",
  "ifscCode": "HDFC0001234",
  "accountNumber": "98765432101234",
  "branchName": "Delhi Branch",
  "upiId": "jane@paytm",
  "printUpiQrOnInvoice": true
}

Response:
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "bankId": "generated-uuid"
  }
}
```

#### Update Existing Bank Account
```json
POST /api/bank-details
Body: {
  "bankId": "550e8400-e29b-41d4-a716-446655440000",
  "accountName": "Jane Smith Updated",
  "bankName": "HDFC Bank",
  "ifscCode": "HDFC0001234",
  "accountNumber": "98765432101234",
  "branchName": "Delhi Branch",
  "upiId": "jane.smith@paytm"
}

Response:
{
  "success": true,
  "message": "Bank details updated successfully"
}
```

#### Minimal Required Fields
```json
POST /api/bank-details
Body: {
  "accountName": "Minimal Account",
  "bankName": "Any Bank",
  "accountNumber": "123456789"
}

Response:
{
  "success": true,
  "message": "Bank details updated successfully",
  "data": {
    "bankId": "generated-uuid"
  }
}
```

#### Validation Errors:

**Missing Required Field:**
```json
{
  "success": false,
  "message": "Account name is required"
}
```

**Invalid IFSC Code:**
```json
POST /api/bank-details
Body: {
  "accountName": "Test",
  "bankName": "Test Bank",
  "accountNumber": "123",
  "ifscCode": "INVALID123"
}

Response:
{
  "success": false,
  "message": "Invalid IFSC code format"
}
```

**Invalid UPI ID:**
```json
POST /api/bank-details
Body: {
  "accountName": "Test",
  "bankName": "Test Bank",
  "accountNumber": "123",
  "upiId": "invalid-upi"
}

Response:
{
  "success": false,
  "message": "Invalid UPI ID format"
}
```

**Invalid SWIFT Code:**
```json
{
  "success": false,
  "message": "Invalid SWIFT code format"
}
```

**Invalid MICR Code:**
```json
{
  "success": false,
  "message": "Invalid MICR code format (must be 9 digits)"
}
```

#### Multiple Accounts Support:
- Each user can have multiple bank accounts
- Each account is identified by a unique `bank_id` (UUID)
- To add a second account, make another POST request without `bankId`
- To update an account, include the `bankId` in the request

#### Usage Notes:
1. **Creating First Account**: Omit `bankId`, system generates unique ID
2. **Adding More Accounts**: Omit `bankId` for each new account
3. **Updating Account**: Include `bankId` of the account to update
4. **Optional Fields**: Can be omitted or sent as empty strings
5. **Case Handling**: IFSC and SWIFT codes auto-converted to uppercase, UPI ID to lowercase
6. **Validation**: Happens before saving, returns clear error messages


---

## Terms & Conditions
Store and retrieve Terms & Conditions text per document type. Each user can define separate terms for different documents.

### Save Terms & Conditions
`POST /api/terms-conditions`
- **Desc**: Save or update terms and conditions for one or more document types. Accepts empty or partial payloads.
- **Header**: `Authorization: Bearer <token>`
- **Body** (all fields optional):
```json
{
  "sale_invoice": "Payment due within 30 days. Late payments subject to interest.",
  "delivery_challan": "Goods once sold will not be taken back.",
  "quotation": "This quotation is valid for 15 days from the date of issue.",
  "proforma": "Advance payment required before dispatch.",
  "purchase_order": "Delivery expected within 7 working days.",
  "sale_order": "Order confirmation required within 24 hours.",
  "job_work": "Work will be completed as per agreed timeline.",
  "credit_note": "Credit note valid for 90 days.",
  "debit_note": "Debit note issued for price difference.",
  "multi_currency_invoice": "Exchange rates as per RBI guidelines.",
  "payment_receipt": "Payment received with thanks."
}
```
- **Response**:
```json
{
  "success": true,
  "message": "Terms and conditions saved successfully"
}
```

#### Empty Payload (Valid)
```json
POST /api/terms-conditions
Body: {}

Response:
{
  "success": true,
  "message": "Terms and conditions saved successfully"
}
```

#### Partial Update
```json
POST /api/terms-conditions
Body: {
  "sale_invoice": "Updated payment terms: Net 45 days.",
  "quotation": "Valid for 30 days."
}

Response:
{
  "success": true,
  "message": "Terms and conditions saved successfully"
}
```
- **Note**: Only updates `sale_invoice` and `quotation`. All other document types retain their existing values.

#### Single Document Type
```json
POST /api/terms-conditions
Body: {
  "delivery_challan": "All goods are subject to inspection upon delivery."
}

Response:
{
  "success": true,
  "message": "Terms and conditions saved successfully"
}
```

### Get Terms & Conditions
`GET /api/terms-conditions`
- **Desc**: Retrieve all saved terms and conditions for the logged-in user.
- **Header**: `Authorization: Bearer <token>`
- **Response (With Saved Data)**:
```json
{
  "success": true,
  "message": "Terms and conditions retrieved successfully",
  "data": {
    "sale_invoice": "Payment due within 30 days. Late payments subject to interest.",
    "delivery_challan": "Goods once sold will not be taken back.",
    "quotation": "This quotation is valid for 15 days from the date of issue.",
    "proforma": "Advance payment required before dispatch.",
    "purchase_order": "Delivery expected within 7 working days.",
    "sale_order": "Order confirmation required within 24 hours.",
    "job_work": "Work will be completed as per agreed timeline.",
    "credit_note": "Credit note valid for 90 days.",
    "debit_note": "Debit note issued for price difference.",
    "multi_currency_invoice": "Exchange rates as per RBI guidelines.",
    "payment_receipt": "Payment received with thanks."
  }
}
```

- **Response (No Saved Data - Defaults)**:
```json
{
  "success": true,
  "message": "Terms and conditions retrieved successfully",
  "data": {
    "sale_invoice": "",
    "delivery_challan": "",
    "quotation": "",
    "proforma": "",
    "purchase_order": "",
    "sale_order": "",
    "job_work": "",
    "credit_note": "",
    "debit_note": "",
    "multi_currency_invoice": "",
    "payment_receipt": ""
  }
}
```

#### Supported Document Types:
- `sale_invoice` - Sale Invoice
- `delivery_challan` - Delivery Challan
- `quotation` - Quotation
- `proforma` - Proforma Invoice
- `purchase_order` - Purchase Order
- `sale_order` - Sale Order
- `job_work` - Job Work
- `credit_note` - Credit Note
- `debit_note` - Debit Note
- `multi_currency_invoice` - Multi Currency Invoice
- `payment_receipt` - Payment Receipt

#### Key Features:
1. **No Required Fields**: All document types are optional
2. **Partial Updates**: Update only specific document types
3. **Empty Strings**: Documents without terms return empty strings
4. **User-Specific**: Each user has their own terms
5. **Flexible Text**: Supports any length of text, including multi-line
6. **No Validation**: Accepts any string value

#### Usage Notes:
- First save creates new record with provided terms
- Subsequent saves update only the provided document types
- Missing keys in payload do not delete existing terms
- To clear terms for a document, send empty string: `"sale_invoice": ""`
- GET always returns all 11 document types
- Empty strings returned for documents without saved terms

#### Workflow Example:
```javascript
// 1. Initial save - set terms for 3 documents
POST /api/terms-conditions
{
  "sale_invoice": "Payment terms...",
  "quotation": "Quote valid for...",
  "delivery_challan": "Delivery terms..."
}

// 2. Fetch all terms
GET /api/terms-conditions
→ Returns all 11 document types
→ 3 have values, 8 are empty strings

// 3. Update one document
POST /api/terms-conditions
{
  "sale_invoice": "Updated payment terms..."
}
→ Only sale_invoice updated
→ quotation and delivery_challan unchanged

// 4. Add terms for new document
POST /api/terms-conditions
{
  "proforma": "Proforma terms..."
}
→ Now 4 documents have terms
```



SHIPPING & ENVELOPE CONFIGURATION MODULE
----------------------------------------

POST /api/shipping-envelope-settings
Header: Authorization: Bearer <token>
Body: {
  "shipping_options": {
    "show_document_details": true,
    "show_items_details": true,
    "show_delivery_instruction": true,
    "show_contact_person_name": true,
    "show_contact_number": true,
    "show_from_details": true,
    "show_product_note": true,
    "show_item_amount": true,
    "show_row_total": true
  },
  "title": "DELIVERY INSTRUCTIONS",
  "instruction": "Handle with care",
  "envelope_options": {
    "show_contact_number": true,
    "show_from_details": true
  }
}
Note: All fields are optional. Empty payload {} is accepted. Only provided keys are updated (merged).
Response: { "success": true, "message": "Shipping & Envelope settings saved successfully" }

GET /api/shipping-envelope-settings
Header: Authorization: Bearer <token>
Response: {
  "shipping_options": { ... },
  "title": "...",
  "instruction": "...",
  "envelope_options": { ... }
}
(Returns saved settings or empty object if none exist)

MESSAGE TEMPLATES MODULE
------------------------

POST /api/message-templates
Header: Authorization: Bearer <token>
Body: {
  "Sales Invoice": {
    "email": { "subject": "Invoice {{invoice-no}}", "body": "Dear {{contact-person}}, ..." },
    "whatsapp": { "subject": "Invoice Alert", "body": "Hi {{contact-person}}, your invoice ..." }
  },
  "Purchase Order": {
    "email": { "subject": "PO {{invoice-no}}", "body": "..." },
    "whatsapp": { "subject": "New PO", "body": "..." }
  }
}
Note: Supports multiple document types. Empty payload {} is accepted. Only provided keys are merged.
Supported tags: {{company}}, {{contact-person}}, {{org-name}}, {{invoice-no}}, {{invoice-date}}, {{amount}}, {{url-link}}, {{tracking-link}}, {{cf-1}}..{{cf-10}}, {{discount}}, {{taxable-value}}, {{payment-received}}, {{balance}}.
Response: { "success": true, "message": "Templates detail updated successfully" }

GET /api/message-templates
Header: Authorization: Bearer <token>
Response: {
  "Sales Invoice": { "email": { ... }, "whatsapp": { ... } },
  ...
}
(Returns saved templates or empty object if none exist)


PAYMENT REMINDER SETTINGS MODULE
--------------------------------

POST /api/payment-reminder-settings
Header: Authorization: Bearer <token>
Body: {
  "email_reminder_enabled": true,
  "whatsapp_reminder_enabled": false
}
Note: Updates only provided keys. Empty object {} is accepted.
Response: { "success": true, "message": "Payment reminder settings updated successfully" }

GET /api/payment-reminder-settings
Header: Authorization: Bearer <token>
Response: {
  "email_reminder_enabled": true,
  "whatsapp_reminder_enabled": false
}
(Returns saved settings or false/false if default)


CUSTOM HEADER DESIGN MODULE
---------------------------

POST /api/custom-header-design
Header: Authorization: Bearer <token>
Body: {
  "layout_type": "modern",
  "design_variant": "shapes",
  "header_height": 120,
  "options": {
    "show_pan": true,
    "show_invoice_title": false,
    "copy_label": "ORIGINAL"
  },
  "layers": [
    {
      "layer_id": "layer_1",
      "type": "text",
      "content": "Company Name",
      "position": { "x": 10, "y": 20 },
      "size": { "width": 200, "height": 50 },
      "style": { "color": "#000", "fontSize": 16 },
      "z_index": 1,
      "is_locked": false,
      "is_visible": true
    },
    {
      "layer_id": "layer_2",
      "type": "image",
      "content": "/uploads/logo.png",
      "position": { "x": 0, "y": 0 },
      "z_index": 0
    }
  ]
}
Note: Updates provided keys. "layers" array is replaced if provided. MISSING keys in "layers" are removed (full replacement). "options" are merged.
Response: { "success": true, "message": "Custom header design saved successfully" }

GET /api/custom-header-design
Header: Authorization: Bearer <token>
Response: {
  "layout_type": "modern",
  "design_variant": "shapes",
  "header_height": 120,
  "options": { ... },
  "layers": [ ... ]
}
(Returns saved design or empty values if default)


POST /api/custom-header-design/upload-image
Header: Authorization: Bearer <token>
Body: Multipart Form Data (Key: "image", Value: File)
Response: { "success": true, "message": "Image uploaded successfully", "image_url": "http://localhost:5000/uploads/image-123.png", "image_id": "image-123.png" }


GET /api/header-shapes
Header: Authorization: Bearer <token>
Response: {
  "success": true,
  "count": 4,
  "data": [
    {
      "shape_id": "shape_rect_1",
      "name": "Rectangle",
      "category": "Basic",
      "thumbnail_url": "...",
      "svg_url": "..."
    },
    ...
  ]
}


# INWARD PAYMENT MODULE

POST /api/inward-payments
Header: Authorization: Bearer <token>
Body: Multipart Form Data
- receiptNo (Required)
- companyName (Required)
- amount (Required, >0)
- paymentDate (Required)
- paymentType (Required: cash, cheque, online, bank, tds, bad_debit, currency_exchange_loss)
- attachment (Optional file)
... other fields
Response: { "success": true, "message": "Inward payment saved successfully", "data": { ... } }

GET /api/inward-payments
Header: Authorization: Bearer <token>
Response: { "success": true, "count": 5, "data": [ ... ] }


GET /api/inward-payments/summary
Header: Authorization: Bearer <token>
Response: {
  "success": true,
  "data": {
    "totalTransactions": 10,
    "totalAmount": 50000,
    "totalAdvanceAmount": 0
  }
}


GET /api/inward-payments/search
Header: Authorization: Bearer <token>
Query Params:
- companyName (partial)
- receiptNo (partial)
- fromDate (YYYY-MM-DD or ISO)
- toDate (YYYY-MM-DD or ISO)
- paymentType (exact)
- amount (exact) OR minAmount & maxAmount
Response: { "success": true, "count": 5, "data": [ ... ] }


# INWARD PAYMENT CUSTOM FIELDS
POST /api/inward-payments/custom-fields
Body: { name, type (TEXT/DATE/DROPDOWN), status, required, options: [] }
Response: { success: true, data: { ... } }

GET /api/inward-payments/custom-fields
Response: { success: true, count: 2, data: [ ... ] }

# EXTENDED INWARD PAYMENT
POST /api/inward-payments
Body addition: customFields: JSONString { "fieldId": "value" }

GET /api/inward-payments/search
Query addition: cf_<fieldId>=value


# OUTWARD PAYMENT MODULE

POST /api/outward-payments
Header: Authorization: Bearer <token>
Body: Multipart Data (paymentNo, companyName, amount, paymentDate, paymentType, attachment, customFields...)
Response: { success: true, message: "Saved", data: {} }

GET /api/outward-payments
Response: { success: true, count: 5, data: [] }

GET /api/outward-payments/summary
Response: { success: true, data: { totalTransactions: 0, totalAmount: 0 } }

GET /api/outward-payments/search
Query: companyName, paymentNo, paymentType, fromDate, toDate, amount, cf_<id>
Response: { success: true, count: 1, data: [] }

POST /api/outward-payments/custom-fields
Body: { name, type, status, ... }

GET /api/outward-payments/custom-fields

