**Base URL**: `http://localhost:5000/api`

## Print Template Settings

### Get Document Types
```http
GET /api/print-template-settings/document-types
Authorization: Bearer <token>
```

### Get Available Templates
```http
GET /api/print-template-settings/templates
Authorization: Bearer <token>
```

### Get Saved Configs
```http
GET /api/print-template-settings?branchId=main
Authorization: Bearer <token>
```

### Get Config by Doc Type
```http
GET /api/print-template-settings/document/Sale%20Invoice?branchId=main
Authorization: Bearer <token>
```

### Save Configs
```http
POST /api/print-template-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "branchId": "main",
  "templateConfigurations": [
    { "documentType": "Sale Invoice", "selectedTemplate": "Designed", "printSize": "A4" }
  ]
}
```

