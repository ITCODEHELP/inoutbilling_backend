
---

## Document Options

### Get Document Options
Retrieves the configuration for all document types (e.g., Sale Invoice).

```http
GET /api/document-options
Authorization: Bearer <token>
```

**Response**
```json
{
  "_id": "65c...",
  "userId": "GSTBILL123...",
  "saleInvoice": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "name": "TAX INVOICE",
        "invoiceTitle": "TAX INVOICE",
        "prefix": "",
        "postfix": ""
      }
    ],
    "statusSettings": {
      "showStatus": true,
      "label": "Status",
      "options": [
        { "name": "New", "color": "Red" },
        { "name": "Completed", "color": "Green" }
      ]
    },
    "defaultOptions": {
      "sortBy": "Invoice No ( Descending )",
      "invoiceType": "No default invoice type",
      "defaultCustomer": "No default customer",
      "defaultPaymentType": "CREDIT",
      "defaultDueDate": 15
    }
  }
}
```

### Save Document Options
Creates or updates the configuration.

```http
POST /api/document-options
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**
```json
{
  "saleInvoice": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "name": "TAX INVOICE",
        "invoiceTitle": "TAX INVOICE"
      }
    ],
    "statusSettings": {
      "showStatus": true,
      "label": "Order Status",
      "options": [
        { "name": "Pending", "color": "Orange" }
      ]
    },
    "defaultOptions": {
      "sortBy": "Invoice No ( Ascending )",
      "defaultPaymentType": "CASH"
    }
  }
}
```
**Response**
```json
{
  "success": true,
  "message": "Document options saved successfully",
  "data": { ... }
}
```
