# Stock Report API Documentation

This document outlines the payloads and structured responses for the Dynamic Stock Report API endpoints, including metadata mapping and drill-down product resolution.

---

## 1. Main Stock Report Endpoint
`POST /api/reports/stock`

This endpoint returns aggregated stock data with available quantities and product metadata overrides. Can be used for "Stock Report" and "Low Stock Report" features.

Other Report Actions (Same Input/Output Structure):
- `POST /api/reports/stock/print`
- `POST /api/reports/stock/email`
- `POST /api/reports/stock/export`
- `POST /api/reports/stock/download`

### Scenario A: Fetching Main Stock Report
Fetches all active stock with related values. The backend uses `$max` to ensure `productGroup`, `unit`, `sellValue`, and `purchaseValue` are not `null`. 

**Request Body:**
```json
{
  "documentType": "Stock Report",
  "productId": "",
  "productGroupId": "",
  "stockAsOnDate": "2026-02-25",
  "minStock": "",
  "maxStock": "",
  "hideZeroStock": true,
  "showSellValue": true,
  "showPurchaseValue": true,
  "page": 1,
  "limit": 50,
  "sortBy": "name",
  "sortOrder": "asc"
}
```

**Expected Successful Output:**
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "productId": "65b9c1d2e3f4a5b6c7d8e9f0",
        "productGroup": "Electronics",
        "hsnSac": "8471",
        "unit": "NOS",
        "stock": 10,
        "productName": "Dell Laptop i5",
        "sellValue": 450000,
        "purchaseValue": 350000
      },
      {
        "productId": "65b9c1d2e3f4a5b6c7d8e9f1",
        "productGroup": "Electronics",
        "hsnSac": "8517",
        "unit": "NOS",
        "stock": 15,
        "productName": "Mobile Phones",
        "sellValue": 150000,
        "purchaseValue": 100000
      }
    ],
    "totalDocs": 2,
    "limit": 50,
    "totalPages": 1,
    "page": 1,
    "summary": {
      "totalStockQty": 25
    }
  },
  "message": "Stock Report generated successfully"
}
```

### Scenario B: Low Stock Report (Native Evaluation)
Fetching only items reaching their `lowStockAlert` threshold. Modifying the `documentType` translates an `$expr` match securely on the backend.

**Request Body:**
```json
{
  "documentType": "Low Stock Report",
  "hideZeroStock": false,
  "showSellValue": true,
  "showPurchaseValue": true,
  "page": 1,
  "limit": 50
}
```

**Expected Successful Output:**
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "productName": "keyboard",
        "stock": -8,
        "lowStockAlert": 5,
        "sellValue": -6400,
        "purchaseValue": 0
      }
    ],
    "totalDocs": 1,
    "limit": 50,
    "totalPages": 1,
    "page": 1,
    "summary": {
      "totalStockQty": -8
    }
  },
  "message": "Stock Report generated successfully"
}
```

---

## 2. Product Drill-Down Endpoint
`POST /api/reports/stock/details`

Fetches running balance array itemized by `Purchase` and `Sale` transactions natively sorted by date. 

### Request Body
The frontend should submit either the `productName` (e.g., `"Dell Laptop i5"`) or the `productId` context from the main report table natively to securely fetch the drilled down stream values.

```json
{
  "productName": "Dell Laptop i5",
  "stockAsOnDate": "2026-02-25",
  "page": 1,
  "limit": 10
}
```

### Response
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "type": "Opening Stock",
        "docNo": "OPENING",
        "date": "1970-01-01",
        "quantityIn": 5,
        "quantityOut": 0,
        "balance": 5,
        "price": 35000,
        "total": 175000
      },
      {
        "type": "Purchase",
        "docNo": "PI-006",
        "date": "2026-02-13",
        "quantityIn": 10,
        "quantityOut": 0,
        "balance": 15,
        "price": 34000,
        "total": 340000
      },
      {
        "type": "Sale",
        "docNo": "SI-001",
        "date": "2026-02-14",
        "quantityIn": 0,
        "quantityOut": 5,
        "balance": 10,
        "price": 45000,
        "total": 225000
      }
    ],
    "totalDocs": 3,
    "summary": {
        "finalStock": 10
    }
  },
  "message": "Stock details fetched successfully"
}
```

---

## 3. Report Actions (Print, PDF, Excel, Email)

You can generate Print Views, PDFs, Excel files, or Email this report using the **Report Action Engine**.

### Endpoints
- **Print (HTML)**: `POST /api/reports/action/print`
- **PDF (Download)**: `POST /api/reports/action/pdf`
- **Excel (Download)**: `POST /api/reports/action/excel`
- **Email (Send PDF)**: `POST /api/reports/action/email`

### Request Body
Use the following payload for all the above endpoints.  
**Note**: `reportType` must be set to `stock`.

```json
{
  "reportType": "stock", 

  "filters": {
    "documentType": "Stock Report",
    "productGroup": "",
    "stockAsOnDate": "2026-02-25",
    "hideZeroStock": true
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "name", 
    "sortOrder": "asc" 
  },

  "reportTitle": "Stock Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```



