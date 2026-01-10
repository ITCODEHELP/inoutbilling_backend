**Base URL**: `http://localhost:5000/api`

## Letters

### Create Letter
```http
POST /api/letters
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "title": "Appointment Letter",
  "letterNumber": {
    "prefix": "ALT",
    "number": "001",
    "postfix": "2024"
  },
  "letterDate": "2024-01-01",
  "templateType": "BLANK",
  "letterBody": "Dear {{name}}, this is your letter for {{letter-no}} on {{letter-date}}."
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

