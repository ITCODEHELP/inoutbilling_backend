**Base URL**: `http://localhost:5000/api`

## General Settings

### Get Settings
```http
GET /api/general-settings
Authorization: Bearer <token>
```

### Update Settings
```http
POST /api/general-settings/update
Authorization: Bearer <token>
```
**Body**: `{ "enableRounding": true, "dateFormat": "DD/MM/YYYY", ... }`

### Upload Branding Images
```http
POST /api/general-settings/upload-images
Authorization: Bearer <token>
Content-Type: multipart/form-data
```
**Body**: `logo`, `signature`, `background`, `footer`

