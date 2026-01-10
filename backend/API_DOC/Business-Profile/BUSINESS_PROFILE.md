**Base URL**: `http://localhost:5000/api`

## Business Profile

### Request Business Profile OTP
```http
POST /api/setting-security/request-business-profile-otp
Authorization: Bearer <token>
```

### Get Business Profile
```http
GET /api/setting-security/business-profile
Authorization: Bearer <token>
```

### Verify & Update Business Profile
```http
POST /api/setting-security/verify-business-profile-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "otp": "...", "gstNumber": "...", ... }`

