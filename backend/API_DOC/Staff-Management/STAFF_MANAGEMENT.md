**Base URL**: `http://localhost:5000/api`

## Staff Management

### Create Staff
```http
POST /api/staff/create
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**: `{ "userId": "...", "fullName": "...", "password": "...", "allowedSections": [...] }`

### Get Staff by Name
```http
GET /api/staff/search/:name
Authorization: Bearer <token>
```

### Get All Staff
```http
GET /api/staff/all
Authorization: Bearer <token>
```


### Update Staff
```http
PUT /api/staff/:id
Authorization: Bearer <token>
Content-Type: application/json
```
**Body (partial update allowed)**
```json
{
  "userId": "kamlesh123",
  "fullName": "Kamlesh Kumar Tel",
  "phone": "09952848465",
  "email": "kamlesh@example.com",
  "password": "Abc123@@",
  "confirmPassword": "Abc123@@",
  "isActive": true,
  "accountActiveHoursEnabled": true,
  "accountActiveHours": [
    { "day": "Monday", "startTime": "09:00", "endTime": "18:30" },
    { "day": "Tuesday", "startTime": "09:00", "endTime": "18:30" },
    { "day": "Wednesday", "startTime": "09:00", "endTime": "18:30" },
    { "day": "Thursday", "startTime": "09:00", "endTime": "18:30" },
    { "day": "Friday", "startTime": "09:00", "endTime": "18:30" },
    { "day": "Saturday", "startTime": "09:00", "endTime": "13:00" },
    { "day": "Sunday", "startTime": "00:00", "endTime": "00:01" }
  ],
  "allowedSections": [
    {
      "sectionName": "Sale Invoice",
      "permissions": { "view": true, "add": true, "edit": true, "remove": true }
    }
  ]
}
```
**Response**
```json
{
  "success": true,
  "message": "Staff account updated successfully",
  "passwordStrength": "strong",
  "passwordMatch": true,
  "data": {
    "...": "updated staff fields without password"
  }
}
```

### Delete Staff (Soft Delete)
```http
DELETE /api/staff/:id
Authorization: Bearer <token>
```
**Behavior**
- Marks staff as inactive (`isActive = false`, `isEnabled = false`)
- Staff will no longer be allowed to login

**Response**
```json
{
  "success": true,
  "message": "Staff account deleted (soft delete) successfully"
}
```

### Staff Login (User ID + Password)
```http
POST /api/staff/login
Content-Type: application/json
```
**Body**
```json
{
  "userId": "kamlesh123",
  "password": "Abc123@@"
}
```

**Validation Logic**
- Verifies `userId` exists
- Verifies password hash
- Checks `isActive === true` and `isEnabled === true`
- If `accountActiveHoursEnabled === true`, ensures current time falls between `startTime` and `endTime` for the current day
- If outside allowed time window, returns:
```json
{
  "success": false,
  "message": "Account Not Allowed To Login At This Time"
}
```

**Success Response**
```json
{
  "success": true,
  "message": "Login successful",
  "passwordStrength": "strong",
  "data": {
    "_id": "staffId",
    "userId": "kamlesh123",
    "fullName": "Kamlesh Kumar Tel",
    "phone": "09952848465",
    "email": "kamlesh@example.com",
    "isActive": true,
    "accountActiveHoursEnabled": true,
    "accountActiveHours": [
      { "day": "Monday", "startTime": "09:00", "endTime": "18:30" }
      // ... all 7 days
    ],
    "allowedSections": [
      {
        "sectionName": "Sale Invoice",
        "permissions": { "view": true, "add": true, "edit": true, "remove": true }
      }
    ]
  }
}
```

**Password Strength & Match Rules (Backend)**
- Length: **8–32 characters**
- Strength categories:
  - `weak` → only alphabets OR only numbers OR only special characters
  - `medium` → alphabets + numbers
  - `strong` → alphabets + numbers + special characters
- Confirm password:
  - If `password !== confirmPassword` → `passwordMatch = false`, message: **"Password Not Matched"**
  - On success responses, API returns `passwordMatch = true`

