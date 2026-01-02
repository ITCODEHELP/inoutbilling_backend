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
}
Response: { "success": true, "message": "Invoice saved successfully", "invoiceId": "..." }

POST /sale-invoice/create-print
Header: Authorization: Bearer <token>
Body: { same as /create }
Response: { "success": true, "message": "Invoice saved successfully", "data": { ...complete invoice... } }

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
Header: Authorization: Bearer <token>
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

