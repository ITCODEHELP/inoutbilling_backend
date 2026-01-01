# Inout Billing Backend

This is the backend authentication service for the Inout Billing application.

## Tech Stack
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication

## Setup

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Variables**
    Create a `.env` file in the root directory (if not exists) and add:
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/inout_billing
    JWT_SECRET=your_jwt_secret_key
    ```

3.  **Run Server**
    - Development (with nodemon):
      ```bash
      npm run dev
      ```
    - Production:
      ```bash
      npm start
      ```
    (Note: ensure you add `"dev": "nodemon server.js"` and `"start": "node server.js"` to your `package.json` scripts if not already present).

## Folder Structure
- `config/`: Database configuration
- `models/`: Mongoose schemas (User, OTP)
- `controllers/`: Request logic
- `routes/`: API route definitions
- `middleware/`: Authentication middleware

## API Documentation
See [API.md](./API.md) for detailed endpoint usage.
