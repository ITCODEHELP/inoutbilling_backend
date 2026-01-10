**Base URL**: `http://localhost:5000/api`

## Product

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

### Get Product Stats
```http
GET /products/stats
Authorization: Bearer <token>
```
**Response**
```json
{ "total": 10, "products": 8, "services": 2 }
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

