**Base URL**: `http://localhost:5000/api`

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

### Delete Manufacture
```http
DELETE /api/manufacture/:id
Authorization: Bearer <token>
```

**Response (Success)**
```json
{
  "success": true,
  "message": "Manufacture deleted successfully"
}
```

**Response (Not Found)**
```json
{
  "success": false,
  "message": "Manufacture not found"
}
```

