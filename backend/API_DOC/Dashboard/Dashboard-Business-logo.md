# Business Logo & Email Verification APIs

## 1. Upload Business Logo
Upload a business logo for the user account. Store securely and link to the user profile.

- **Endpoint**: `POST /api/user/upload-logo`
- **Method**: `POST`
- **Authentication**: Required (JWT)
- **Content-Type**: `multipart/form-data`
- **Request Body**:
  - `logo`: File (Image - JPG, JPEG, PNG, max 5MB)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Logo uploaded successfully",
    "data": {
      "businessLogo": "uploads/business_logos/logo-..."
    }
  }
  ```

## 2. Send Verification Email
Generate a secure single-use verification link and log it (simulating email send).

- **Endpoint**: `POST /api/user/send-verification-email`
- **Method**: `POST`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "message": "Verification email sent successfully",
    "data": {
      "verificationLink": "http://localhost:5000/api/user/verify-email/..."
    }
  }
  ```

## 3. Verify Email
Fulfill the email verification when the link is clicked. Marks the user as verified and redirects to the dashboard.

- **Endpoint**: `GET /api/user/verify-email/:token`
- **Method**: `GET`
- **Authentication**: None
- **URL Parameters**:
  - `token`: The secure verification token sent in the email.
- **Response**:
  - Redirects to `/dashboard?verified=true` on success.
  - Returns `400 Bad Request` on invalid or expired token.

## 4. Dashboard Integration
The dashboard response includes the business logo and conditional options.

- **Endpoint**: `GET /api/dashboard/sales-summary`
- **Response Field**: `businessLogo` (String) - Path to the uploaded logo.
- **Response Field**: `dashboardOptions` (Array) - Contains "Verify Email" if the user's email is not yet verified.
