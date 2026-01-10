**Base URL**: `http://localhost:5000/api`

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

