**Base URL**: `http://localhost:5000/api`

## Message Templates

### Save Templates
```http
POST /api/message-templates
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "Sales Invoice": { "email": { "subject": "..." }, "whatsapp": { "body": "..." } }
}
```

### Get Templates
```http
GET /api/message-templates
Authorization: Bearer <token>
```

