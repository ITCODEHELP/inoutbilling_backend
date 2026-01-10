**Base URL**: `http://localhost:5000/api`

## Custom Header Design

### Save Design
```http
POST /api/custom-header-design
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "layout_type": "modern", "layers": [ ... ] }`

### Get Design
```http
GET /api/custom-header-design
Authorization: Bearer <token>
```

### Upload Image
```http
POST /api/custom-header-design/upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `image` (File)

### Get Header Shapes
```http
GET /api/header-shapes
Authorization: Bearer <token>
```

