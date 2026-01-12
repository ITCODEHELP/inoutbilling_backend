# WhatsApp-API

## 1. Get WhatsApp Config
Returns the predefined WhatsApp business number, working hours, and a personalized deep-link for the current user.

- **Endpoint**: `GET /api/whatsapp/config`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "businessNumber": "9725306146",
      "workingHours": "Monday - Friday: 09:00 AM - 06:00 PM (GMT+5:30)",
      "messageTemplate": "Hi, I'm John Doe. I'm interested in learning more...",
      "deepLink": "https://wa.me/9725306146?text=Hi%2C%20I'm%20John%20Doe..."
    }
  }
  ```

## 2. Track Interaction
Logs a click event when a user interacts with the WhatsApp engagement link.

- **Endpoint**: `POST /api/whatsapp/track`
- **Method**: `POST`
- **Authentication**: Required (JWT)
- **Request Body**:
  ```json
  {
    "sourcePage": "Dashboard"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Interaction logged successfully",
    "data": {
      "id": "65866847c20c4a457c123456",
      "timestamp": "2026-01-12T10:00:00.000Z"
    }
  }
  ```
