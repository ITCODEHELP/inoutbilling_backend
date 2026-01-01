BASE URL
http://localhost:5000/api

POST /auth/send-otp
POST /auth/verify-otp
POST /auth/login
POST /auth/login-userid
POST /auth/resend-otp

POST /user/update-profile
Header: Authorization: Bearer <token>
Body: { "gstNumber": "...", "companyName": "...", "address": "...", "pincode": "...", "city": "...", "state": "..." }

GET /customers/download-customers
Response: File download (customers.xlsx)
