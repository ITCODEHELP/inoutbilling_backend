# Support-PIN-API

## 1. Generate Support PIN
Generates a secure 6-digit support PIN that remains valid for exactly 8 minutes. Each new request invalidates any previous PIN for the user.

- **Endpoint**: `POST /api/support-pin/generate`
- **Method**: `POST`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "pin": "582931",
      "expiresAt": "2026-01-12T11:10:00.000Z"
    }
  }
  ```

## 2. Verify Support PIN
Verifies a provided PIN against the stored valid PIN for a user.

- **Endpoint**: `POST /api/support-pin/verify`
- **Method**: `POST`
- **Authentication**: Required (JWT)
- **Request Body**:
  ```json
  {
    "pin": "582931",
    "userId": "658668..." (Optional if logged in as the specific user)
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "PIN verified successfully"
  }
  ```

> [!IMPORTANT]
> PINs automatically expire and are purged from the system after 8 minutes.
