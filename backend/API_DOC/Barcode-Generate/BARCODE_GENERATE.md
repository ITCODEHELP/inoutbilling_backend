**Base URL**: `http://localhost:5000/api`

## Barcode Generate

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

