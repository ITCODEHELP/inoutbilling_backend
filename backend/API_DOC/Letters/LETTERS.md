**Base URL**: `http://localhost:5000/api`

## Letters

### Create Letter
```http
POST /api/letters
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body (Dynamic Builder)**
```json
{
  "title": "Business Letter",
  "templateType": "LETTER_OF_INTENT",
  "blocks": [
    { "id": "b1", "type": "heading", "content": "LOI Title", "style": { "level": 1 } },
    { "id": "b2", "type": "text", "content": "This is a letter of intent..." },
    { "id": "b3", "type": "delimiter" },
    { "id": "b4", "type": "entitySelector", "metadata": { "entityId": "CUSTOMER_ID" } }
  ]
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


## Dynamic Letter Builder (Advanced Content Blocks)

The letter builder supports an ordered list of blocks. Each block is an object with a unique `id`, `type`, and `content`.

### Block Types
- `text`: Simple markdown or plain text.
- `heading`: Heading text with `style: { level: 1-6 }`.
- `pageBreak`: Forces a new page in PDF rendering.
- `list`: Numbered or bulleted items.
- `table`: 3x3 empty table or custom data.
- `image`: URL or reference to an uploaded image.
- `delimiter`: Horizontal separator (rendered as `***`).
- `entitySelector`: Table containing full details of a Customer or Vendor.
- `productSelector`: Table containing details of a single Product/Service.
- `multiProductSelector`: Table containing details of multiple Selected Products.

### Entity Selection (Letter Builder)

These APIs support the selection of a Customer or Vendor to be inserted as a detail block in the letter.

#### 1. List All Customers (Short)
Returns only the ID and Company Name.
```http
GET /api/letters/entities/customers
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "companyName": "ABC Corp" },
    { "_id": "...", "companyName": "XYZ Ltd" }
  ]
}
```

#### 2. List All Vendors (Short)
Returns only the ID and Company Name.
```http
GET /api/letters/entities/vendors
Authorization: Bearer <token>
```

#### 3. List All Entities (Combined)
Returns a combined list of Customers and Vendors with an `entityType` field.
```http
GET /api/letters/entities/all
Authorization: Bearer <token>
```
**Response**
```json
{
  "success": true,
  "data": [
    { "_id": "...", "companyName": "ABC Corp", "entityType": "customer" },
    { "_id": "...", "companyName": "XYZ Ltd", "entityType": "vendor" }
  ]
}
```

#### 4. List All Products (Search & Filter)
Returns normalized product/service data with support for search and pagination.
```http
GET /api/letters/entities/products?search=item&type=Product&page=1&limit=10
Authorization: Bearer <token>
```
**Query Parameters**
- `search`: Search by name, barcode, or HSN/SAC
- `type`: Filter by `Product` or `Service`
- `page`, `limit`: Pagination parameters

**Response**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "name": "Widget A",
      "itemType": "Product",
      "barcodeNumber": "SKU123",
      "hsnSac": "1234",
      "sellPrice": 100,
      "taxSelection": 18,
      "unitOfMeasurement": "PCS",
      "saleDiscount": { "value": 5, "type": "Percentage" },
      "availableQuantity": 50,
      "status": "Active"
    }
  ],
  "pagination": { ... }
}
```

#### 5. Resolve Content (Auto-Populate Details)
Fetch full details of a selected entity or product to be automatically attached/populated in the document.
```http
POST /api/letters/resolve-content
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body (Entity)**
```json
{
  "type": "entitySelector",
  "entityType": "customer", // or "vendor"
  "id": "ENTITY_ID"
}
```
**Request Body (Product)**
```json
{
  "type": "productSelector",
  "id": "PRODUCT_ID"
}
```

**Response**
Returns full object (all schema fields) for auto-filling forms/tables.

### Block Types
```json
{
  "title": "Business Letter",
  "templateType": "LETTER_OF_INTENT",
  "blocks": [
    { "id": "b1", "type": "heading", "content": "LOI Title", "style": { "level": 1 } },
    { "id": "b2", "type": "text", "content": "This is a letter of intent..." },
    { "id": "b3", "type": "delimiter" },
    { "id": "b4", "type": "entitySelector", "metadata": { "entityId": "CUSTOMER_ID" } }
  ]
}
```

### Move Block (Backend Controlled Reordering)
```http
PATCH /api/letters/:id/blocks/:blockId/move
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "direction": "up" // or "down"
}
```

### Delete Block
```http
DELETE /api/letters/:id/blocks/:blockId
Authorization: Bearer <token>
```
