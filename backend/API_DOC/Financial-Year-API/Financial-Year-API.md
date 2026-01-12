# Financial-Year-API

## 1. Get All Financial Years
Returns the master list of available Financial Years. This is used for populating dropdowns and selection menus.

- **Endpoint**: `GET /api/financial-year/years`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "_id": "658668...",
        "label": "F.Y. 2025-2026",
        "startDate": "2025-04-01T00:00:00.000Z",
        "endDate": "2026-03-31T23:59:59.000Z",
        "isDefault": true
      },
      ...
    ]
  }
  ```

## 2. Get Active Financial Year
Fetch the currently active Financial Year for the logged-in user context.

- **Endpoint**: `GET /api/financial-year`
- **Method**: `GET`
- **Authentication**: Required (JWT)
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "_id": "658668...",
      "label": "F.Y. 2025-2026",
      "startDate": "2025-04-01T00:00:00.000Z",
      "endDate": "2026-03-31T23:59:59.000Z"
    }
  }
  ```

## 3. Set Active Financial Year
Globally scope the user's data view by selecting a specific Financial Year. All subsequent data-fetching APIs will implicitly use this selection.

- **Endpoint**: `PATCH /api/financial-year`
- **Method**: `PATCH`
- **Authentication**: Required (JWT)
- **Request Body**:
  ```json
  {
    "financialYearId": "658668..."
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Financial Year switched to F.Y. 2025-2026",
    "data": {
      "activeFinancialYearId": "658668...",
      "label": "F.Y. 2025-2026"
    }
  }
  ```

> [!TIP]
> **Scaling Note**: Data is partitioned by `companyId + financialYearId`. For absolute consistency at 100M+ scale, consumers can explicitly pass the active FY ID via the `X-FY-ID` header.
