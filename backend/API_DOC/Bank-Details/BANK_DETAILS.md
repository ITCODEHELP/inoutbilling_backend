**Base URL**: `http://localhost:5000/api`

## Bank Details

### Save Bank Details
```http
POST /api/bank-details
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "bankId": "optional-uuid",
  "accountName": "John Doe",
  "bankName": "SBI",
  "accountNumber": "123456"
}
```

