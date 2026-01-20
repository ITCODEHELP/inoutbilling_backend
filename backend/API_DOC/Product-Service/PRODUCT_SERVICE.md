**Base URL**: `http://localhost:5000/api`

## Product & Service APIs

These APIs handle both Products and Services. Use `itemType` to distinguish between them. Note that `batchData` and `serialData` are only applicable for Products with specific `inventoryType`.

### Create Product / Service
```http
POST /products
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Request Body (form-data)**

| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | **Required**. Item Name |
| `itemType` | Enum | `Product` or `Service`. Default: `Product` |
| `productNote` | String | Additional notes about the item |
| `barcodeNumber` | String | Barcode for the item |
| `hsnSac` | String | HSN (for Product) or SAC (for Service) |
| `unitOfMeasurement` | String | Unit (e.g., Pcs, Kg, Nos) |
| `taxSelection` | Number | **Required**. Tax percentage (e.g., 18, 5) |
| `cessPercent` | Number | CESS percentage |
| `cessAmount` | Number | Fixed CESS amount |
| `fixedNoItcFlag` | Boolean | Fixed/No-ITC flag |
| `inventoryType` | Enum | `Normal`, `Batch`, `Serial`. Only for Products. |
| `availableQuantity` | Number | Opening/Current stock |
| `sellPrice` | Number | Sale price |
| `sellPriceInclTax` | Boolean | Whether sell price includes tax |
| `saleDiscount` | JSON Object | `{ "value": 0, "type": "Percentage"|"Flat" }` |
| `purchasePrice` | Number | Purchase price |
| `purchasePriceInclTax`| Boolean | Whether purchase price includes tax |
| `purchaseDiscount` | JSON Object | `{ "value": 0, "type": "Percentage"|"Flat" }` |
| `lowStockAlert` | Number | Threshold for low stock notification |
| `productGroup` | String | Group name for mapping |
| `manufactureFlag` | Boolean | Whether item is manufactured |
| `nonSellableFlag` | Boolean | Whether item is non-sellable |
| `batchData` | JSON Array | Array of objects for Batch stock (see below) |
| `serialData` | JSON Object | Object for Serial stock (see below) |
| `images` | File(s) | Up to 5 images from local system |

**Batch Data Structure** (Only if `inventoryType` = `Batch`)
```json
[
  {
    "batchNo": "B123",
    "quantity": 50,
    "salePrice": 120,
    "salePriceInclTax": true,
    "purchasePrice": 80,
    "purchasePriceInclTax": true,
    "barcodeNo": "BAR-B123",
    "lowStockAlert": 5,
    "saleDiscount": { "value": 0, "type": "Percentage" },
    "purchaseDiscount": { "value": 0, "type": "Percentage" }
  }
]
```

**Serial Data Structure** (Only if `inventoryType` = `Serial`)
```json
{
  "serialNumbers": ["SN001", "SN002", "SN003"],
  "sellPrice": 150,
  "sellPriceInclTax": false,
  "saleDiscount": { "value": 5, "type": "Flat" },
  "purchasePrice": 100,
  "purchasePriceInclTax": false,
  "purchaseDiscount": { "value": 0, "type": "Percentage" },
  "lowStockAlert": 1
}
```

### Get Products & Services
```http
GET /products?page=1&limit=10&search=iphone&itemType=Product
Authorization: Bearer <token>
```
**Response**
```json
{
  "data": [
    {
       "_id": "...",
       "name": "IPhone 15",
       "itemType": "Product",
       "taxSelection": 18,
       "inventoryType": "Normal",
       "availableQuantity": 10,
       "images": [
         {
           "fileName": "170538000-image.png",
           "filePath": "src/uploads/products/170538000-image.png",
           "fileSize": 10240,
           "mimeType": "image/png"
         }
       ],
       ...
    }
  ],
  "pagination": { "total": 100, "page": 1, "pages": 10 }
}
```

### Get Stats
```http
GET /products/stats
Authorization: Bearer <token>
```
**Response**
```json
{ "total": 10, "products": 8, "services": 2 }
```

### Get by ID
```http
GET /products/:id
Authorization: Bearer <token>
```
Returns full data including `batchData` or `serialData` and image metadata.

### Update Product / Service
```http
PUT /products/:id
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
Same fields as Create. Uploading new images will replace existing image metadata.

### Delete Product / Service
```http
DELETE /products/:id
Authorization: Bearer <token>
```
Performs a **soft delete** by setting the status to `Deleted` and returns the updated product object.

### Cancel Product / Service
```http
POST /products/:id/cancel
Authorization: Bearer <token>
```
Sets the product status to `Cancelled`.

### Restore Product / Service
```http
POST /products/:id/restore
Authorization: Bearer <token>
```
Sets the product status to `Active`.

### Note on Status & Deletion
- All products/services include a `status` field (`Active`, `Cancelled`, `Deleted`).
- `GET /products` and `GET /api/products/manage-stock` hide `Deleted` items by default.
- To filter by status, use the `status` query parameter (e.g., `GET /products?status=Cancelled`).

---

## Manage Stock

### Get Manage Stock
```http
GET /api/products/manage-stock?search=abc&stockStatus=Low Stock
Authorization: Bearer <token>
```
**Response** includes `inventoryType` and `availableQuantity`.

### Export Product Log
```http
GET /api/products/export-log?search=abc&stockStatus=Low Stock&fromDate=2026-01-01&toDate=2026-01-31
Authorization: Bearer <token>
```
**Query Parameters**
- Supports all filters from Get Products and Manage Stock: `search`, `productGroup`, `itemType`, `stockStatus`, `inventoryType`.
- `fromDate` & `toDate`: Filter logs by creation date.

**Response**
- Directly returns an Excel file (`Product_Log.xlsx`) as a download.

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

### Update Group
```http
PUT /product-group/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{ "groupName": "New Name", "description": "New Description" }
```

### Delete Group
```http
DELETE /product-group/:id
Authorization: Bearer <token>
```
*Note: Deletion is blocked if products are linked to this group.*


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

