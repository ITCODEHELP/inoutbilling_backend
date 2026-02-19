# Stock Report

## Endpoint: Generate Stock Report
`POST /api/reports/stock`

Other Actions (Same Input/Output):
- `POST /api/reports/stock/print`
- `POST /api/reports/stock/email`
- `POST /api/reports/stock/export`
- `POST /api/reports/stock/download`

### Request Body
```json
{
  "filters": {
    "productName": "Item A",
    "productGroup": "Electronics",
    "hsnCode": "1234",
    "stockAsOnDate": "2026-01-31",
    "minStock": 10,
    "maxStock": 100,
    "hideZeroStock": true,
    "showSellValue": true,
    "showPurchaseValue": true
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "name", // name, productGroup, stock, sellValue, purchaseValue
    "sortOrder": "asc"
  }
}
```

### Response
```json
{
  "success": true,
  "data": {
    "docs": [
      {
        "_id": "60d5f...id",
        "name": "Item A",
        "productGroup": "Electronics",
        "hsnSac": "1234",
        "sellPrice": 100,
        "purchasePrice": 80,
        "stock": 50,
        "sellValue": 5000,
        "purchaseValue": 4000
      }
    ],
    "totalDocs": 1,
    "limit": 50,
    "totalPages": 1,
    "page": 1,
    "companyDetails": {
      "companyName": "My Company",
      "address": "123 St",
      "city": "Mumbai",
      "state": "MH",
      "pincode": "400001",
      "phone": "9999999999",
      "email": "info@example.com"
    },
    "totals": {
      "totalStock": 50,
      "totalSellValue": 5000,
      "totalPurchaseValue": 4000
    }
  }
}
```

---

## Report Actions (Print, PDF, Excel, Email)

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
    "productGroup": "",
    "stockAsOnDate": "2026-01-31"
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
