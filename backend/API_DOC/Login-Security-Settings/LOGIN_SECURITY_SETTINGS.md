**Base URL**: `http://localhost:5000/api`

## Login & Security Settings

### Request Phone Change OTP
```http
POST /api/setting-security/request-phone-change-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "newPhone": "9876543210" }`

### Verify Phone Change OTP
```http
POST /api/setting-security/verify-phone-change-otp
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "newPhone": "...", "otp": "..." }`

### Request Email Change OTP
```http
POST /api/setting-security/request-email-change-otp
Authorization: Bearer <token>
```
**Body**: `{ "newEmail": "user@example.com" }`

### Verify Email Change OTP
```http
POST /api/setting-security/verify-email-change-otp
Authorization: Bearer <token>
```
**Body**: `{ "newEmail": "...", "otp": "..." }`

### Request Credentials OTP
```http
POST /api/setting-security/request-credentials-otp
Authorization: Bearer <token>
```
**Body**: `{ "userId": "...", "password": "...", "confirmPassword": "..." }`

### Verify Credentials OTP
```http
POST /api/setting-security/verify-credentials-otp
Authorization: Bearer <token>
```
**Body**: `{ "otp": "...", "userId": "...", "password": "..." }`

