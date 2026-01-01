# Inout Billing Authentication API

**Base URL**: `http://localhost:5000/api/auth`

## 1. Send OTP (Signup)
Request an OTP for a given phone number to start the signup process.

- **Endpoint**: `POST /send-otp`
- **Request Body**:
  ```json
  {
    "phone": "9876543210"
  }
  ```
- **Response**:
  ```json
  {
    "message": "OTP sent successfully",
    "otp": "123456" // ONLY IN DEV MODE
  }
  ```

## 2. Verify OTP (Signup & Login)
Verify the OTP sent to the phone. If the user doesn't exist, a new user is created. Handles both signup verification and login verification.

- **Endpoint**: `POST /verify-otp`
- **Request Body**:
  ```json
  {
    "phone": "9876543210",
    "otp": "123456"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Signup/Verification successful",
    "_id": "64f1b2...",
    "userId": "GSTBILL172839",
    "phone": "9876543210",
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

## 3. Login (Phone or Email)
Initiate login using either phone number or email address. This triggers an OTP to the registered phone number.

- **Endpoint**: `POST /login`
- **Request Body**:
  ```json
  {
    "identifier": "9876543210" 
    // OR
    "identifier": "user@example.com"
  }
  ```
- **Response**:
  ```json
  {
    "message": "OTP sent to 9876543210",
    "otp": "123456"
  }
  ```

## 4. Login with UserID
Direct login using the generated UserID.

- **Endpoint**: `POST /login-userid`
- **Request Body**:
  ```json
  {
    "userId": "GSTBILL172839"
  }
  ```
- **Response**:
  ```json
  {
    "message": "Login successful",
    "_id": "64f1b2...",
    "userId": "GSTBILL172839",
    "token": "eyJhbGciOiJIUzI1NiIsIn..."
  }
  ```

## 5. Resend OTP
Request to resend the OTP if it expired or wasn't received.

- **Endpoint**: `POST /resend-otp`
- **Request Body**:
  ```json
  {
    "phone": "9876543210"
  }
  ```
- **Response**:
  ```json
  {
    "message": "OTP resent successfully",
    "otp": "123456"
  }
  ```

## Auth Header Usage
For accessing protected routes (if any are added in future), use the `Authorization` header with the Bearer token.
- **Header**: `Authorization: Bearer <your_jwt_token>`

## Developer Note
- **OTP Mode**: Currently, the OTP is hardcoded to `123456` for all requests. The SMS gateway integration point is marked in the code for future implementation.
