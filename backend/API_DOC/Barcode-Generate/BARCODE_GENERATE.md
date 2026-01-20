**Base URL**: `http://localhost:5000/api`

## Barcode Generate

### Generate Barcodes
```http
POST /barcode-generate/generate
Authorization: Bearer <token>
```
Generates barcodes for all products in the cart. Each product uses its unique barcode number from the product master (barcodeNumber field, or SKU, or product ID as fallback). Multiple labels for the same product will all display the same barcode.

**Response**
```json
{
  "userId": "...",
  "items": [ 
    { 
      "productId": "...",
      "productName": "...",
      "noOfLabels": 5,
      "generatedBarcodes": ["PROD123", "PROD123", "PROD123", "PROD123", "PROD123"]
    } 
  ],
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

### Download Barcode PDF
```http
GET /barcode-generate/history/:id/download
Authorization: Bearer <token>
```
Downloads the generated barcodes as a PDF file with `Content-Disposition: attachment`.

**Response**: PDF file download

### Print Barcode PDF
```http
GET /barcode-generate/history/:id/print
Authorization: Bearer <token>
```
Opens the generated barcodes as a PDF for printing with `Content-Disposition: inline`.

**Response**: PDF file for inline display/printing

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

