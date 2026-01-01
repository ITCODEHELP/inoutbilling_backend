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
