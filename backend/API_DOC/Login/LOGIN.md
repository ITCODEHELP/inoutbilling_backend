**Base URL**: `http://localhost:5000/api`

## Authentication

### Send OTP
```http
POST /auth/send-otp
Content-Type: application/json
```
**Request Body**
```json
{ "phone": "9876543210" }
```

### Verify OTP
```http
POST /auth/verify-otp
Content-Type: application/json
```
**Request Body**
```json
{ "phone": "9876543210", "otp": "123456" }
```

### Login
```http
POST /auth/login
Content-Type: application/json
```

### Login with User ID
```http
POST /auth/login-userid
Content-Type: application/json
```

### Resend OTP
```http
POST /auth/resend-otp
Content-Type: application/json
```

---

## User

### Update Profile
```http
POST /user/update-profile
Authorization: Bearer <token>
Content-Type: application/json
```
**Request Body**
```json
{
  "gstNumber": "...",
  "companyName": "...",
  "address": "...",
  "pincode": "...",
  "city": "...",
  "state": "..."
}
```

