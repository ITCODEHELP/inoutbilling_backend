# Login & Onboarding API Documentation

## 1. Send OTP
**Endpoint**: `POST /api/auth/send-otp`
**Description**: Sends a 4-digit OTP to the provided mobile number **strictly via MSG91 Live API**. 
- Formats mobile number to `91XXXXXXXXXX`.
- Checks rate limit (6/day).
- Internally detects if user exists (Login flow) or not (Signup flow).
- **Returns strict error** if MSG91 fails.

**Request Body**:
```json
{
  "mobile": "9876543210",
  "countryCode": "+91"
}
```
**Response**:
```json
{
  "message": "OTP sent successfully",
  "id": "36616c76326b78506f516354"
}
```

## 2. Verify OTP (Signup & Login - Auto Detected)
**Endpoint**: `POST /api/auth/verify-otp`
**Description**: Verifies OTP. Backend checks User collection to determine flow:
- **Mobile Exists:** Logs in user → Redirect `dashboard`.
- **Mobile New:** Creates user (`GSTBILLxxxx`) → Redirect `add-business`.

**Request Body**:
```json
{
  "mobile": "9876543210",
  "countryCode": "+91",
  "otp": "1234"
}
```
**Response (Existing User)**:
```json
{
  "message": "Login successful",
  "token": "jwt_token_here",
  "user": {
      "id": "mongo_id",
      "userId": "GSTBILL839201",
      "mobile": "9876543210",
      "redirect": "dashboard"
  }
}
```
**Response (New User)**:
```json
{
  "message": "Signup successful",
  "token": "jwt_token_here",
  "user": {
      "id": "mongo_id",
      "userId": "GSTBILL839201",
      "mobile": "9876543210",
      "redirect": "add-business"
  }
}
```
*Note: Frontend must redirect to `Add Business` screen if response contains `redirect: "add-business"`.*

## 3. Login with User ID
**Endpoint**: `POST /api/auth/login-userid`
**Request Body**:
```json
{
  "userId": "GSTBILL839201",
  "password": "mypassword"
}
```

## 4. Forgot Password
**Endpoint**: `POST /api/auth/forgot-password`
**Request Body**:
```json
{
  "userId": "GSTBILL839201",
  "email": "user@example.com",
  "gstin": "24ABCDE..."
}
```

## 5. GST Auto Fill
**Endpoint**: `GET /api/auth/public/gst-autofill/:gstin`
**Description**: Fetches company details from GST API.
**Response**:
```json
{
  "status": "OK",
  "gstno": "24ABCDE...",
  "gstapicall_data": {
    "name": "Company Name",
    "address1": "Address 1",
    "city": "City",
    "state": "State",
    "pincode": "123456"
  }
}
```

## 6. Add Business
**Endpoint**: `POST /api/auth/business/add`
**Description**: Compulsory step after signup.
**Authentication**: Required (Bearer Token)
**Request Body**:
```json
{
  "haveGstin": true, // or false
  "gstin": "24ABCDE...", // required if haveGstin=true
  "companyName": "My Company",
  "fullName": "John Doe",
  "email": "john@example.com",
  "address": "Street 1",
  "address2": "Street 2",
  "pincode": "395006",
  "city": "Surat",
  "state": "Gujarat"
}
```
**Response**:
```json
{
  "message": "Business added successfully",
  "business": { ... }
}
```
