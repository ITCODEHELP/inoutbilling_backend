**Base URL**: `http://localhost:5000/api`

## Payment Reminder

### Save Settings
```http
POST /api/payment-reminder-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "email_reminder_enabled": true }`

### Get Settings
```http
GET /api/payment-reminder-settings
Authorization: Bearer <token>
```

