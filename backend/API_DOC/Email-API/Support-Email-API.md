# Support-Email-API

## 1. Get Support Email Config
Returns the business support email, expected response time, and a personalized mailto deep-link for the current user.

- **Endpoint**: `GET /api/support-email/config`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "supportEmail": "support@inoutbilling.com",
      "expectedResponseTime": "within 24 hours",
      "subject": "Support Request from John Doe",
      "body": "Hi Support Team,\n\nI am John Doe (john@example.com). I have the following query:\n\n",
      "mailtoLink": "mailto:support@inoutbilling.com?subject=Support%20Request%20from%20John%20Doe&body=..."
    }
  }
  ```

> [!NOTE]
> All templates and contact details are stored in the database, allowing for dynamic updates without backend code changes.
