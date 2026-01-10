**Base URL**: `http://localhost:5000/api`

## Staff Management

### Create Staff
```http
POST /api/staff/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "userId": "...", "fullName": "...", "password": "...", "allowedSections": [...] }`

### Get Staff by Name
```http
GET /api/staff/search/:name
Authorization: Bearer <token>
```

### Get All Staff
```http
GET /api/staff/all
Authorization: Bearer <token>
```

