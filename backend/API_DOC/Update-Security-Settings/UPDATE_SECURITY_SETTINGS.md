**Base URL**: `http://localhost:5000/api`

## Update Security Settings

### Update Security Settings
```http
POST /api/setting-security/update-settings
Authorization: Bearer <token>
```
**Body**: `{ "trackLoginLocation": true }`

### Get Login History
```http
GET /api/setting-security/history
Authorization: Bearer <token>
```

### Logout All Devices
```http
POST /api/setting-security/logout-all
Authorization: Bearer <token>
```

