**Base URL**: `http://localhost:5000/api`

## Print Options

### Save Options
```http
POST /api/print-options
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "headerPrintSettings": { "showLogo": true },
  "footerPrintSettings": { "showSignature": true }
}
```

