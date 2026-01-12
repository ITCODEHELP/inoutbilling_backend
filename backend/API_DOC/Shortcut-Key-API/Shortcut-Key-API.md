# Shortcut-Key-API

## 1. Get Shortcut Definitions
Returns the master configuration of shortcut keys, including module names, actions, key combinations, and target routes.

- **Endpoint**: `GET /api/shortcuts/definitions`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "658668...",
        "moduleName": "Sales",
        "actionLabel": "Create Invoice",
        "keyCombination": "Alt+S+I",
        "targetRoute": "/sales/invoice/create",
        "queryParams": {}
      },
      ...
    ]
  }
  ```

## 2. Get Shortcut Preference
Fetches the current user's preference for whether shortcut keys are enabled or disabled Globally.

- **Endpoint**: `GET /api/shortcuts/preference`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "isEnabled": true
    }
  }
  ```

## 3. Update Shortcut Preference
Updates the current user's shortcut key preference (enable/disable).

- **Endpoint**: `PATCH /api/shortcuts/preference`
- **Method**: `PATCH`
- **Authentication**: Required (JWT)
- **Request Body**:
  ```json
  {
    "isEnabled": false
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Shortcuts disabled successfully",
    "data": {
      "isEnabled": false
    }
  }
  ```

> [!NOTE]
> The backend serves the shortcut metadata and user state. The frontend is responsible for binding the keys and performing the redirection based on the metadata.
