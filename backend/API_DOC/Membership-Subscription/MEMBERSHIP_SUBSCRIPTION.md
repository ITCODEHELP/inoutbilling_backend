**Base URL**: `http://localhost:5000/api`

## Membership & Subscription

### Seed Plans
```http
POST /api/setting-membership/seed-plans
```

### Get Plans
```http
GET /api/setting-membership/plans
```

### Get Current Membership
```http
GET /api/setting-membership/current
```

### Initiate Upgrade
```http
POST /api/setting-membership/upgrade
Content-Type: application/json
```
**Request Body**: `{ "planId": "..." }`

### Get Payment History
```http
GET /api/setting-membership/payments
```

