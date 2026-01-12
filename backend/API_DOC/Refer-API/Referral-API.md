# Refer-API

## 1. Get Referral Stats
Fetch the secure referral code, unique referral URL, platform-specific share links, and current referral counts.

- **Endpoint**: `GET /api/referral/stats`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "referralCode": "A1B2C3D4E5",
      "referralUrl": "http://localhost:5000/api/referral/go/A1B2C3D4E5",
      "shareLinks": {
        "whatsapp": "...",
        "facebook": "...",
        "twitter": "...",
        "email": "..."
      },
      "totalReferrals": 10,
      "premiumReferrals": 2
    }
  }
  ```

## 2. Resolve Referral Code
Resolves a secure referral code into referrer metadata. This is a public, headless endpoint that the frontend calls to identify the referrer and display their information.

- **Endpoint**: `GET /api/referral/go/:referralCode`
- **Method**: `GET`
- **Authentication**: Public
- **URL Parameter**: `referralCode` (The secure code of the referrer)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "referralCode": "A1B2C3D4E5",
      "referrer": {
        "companyName": "Acme Corporation",
        "countryCode": "+91",
        "phone": "98******12"
      },
      "suggestedRedirect": "/signup"
    }
  }
  ```

## 3. Track Referral
Connects a newly created account to the referrer using their `referralCode`. This should be called after a successful signup once the `referredId` is available.

- **Endpoint**: `POST /api/referral/track`
- **Method**: `POST`
- **Authentication**: Public
- **Request Body**:
  ```json
  {
    "referralCode": "A1B2C3D4E5",
    "referredId": "65866847c20c4a457c123456"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Referral tracked successfully",
    "data": {
      "id": "...",
      "referrerId": "...",
      "referredId": "...",
      "accountType": "FREE"
    }
  }
  ```
