**Base URL**: `http://localhost:5000/api`

## Document Options

### Save Document Options
```http
POST /api/document-options
Authorization: Bearer <token>
```
**Body**
```json
{
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
      "label": "Order Status",
      "options": [
        {
          "name": "Pending",
          "color": "Orange"
        }
      ]
    },
    "defaultOptions": {
      "sortBy": "Invoice No ( Ascending )",
      "defaultPaymentType": "CASH"
    }
  },
  "deliveryChallan": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "name": "DELIVERY CHALLAN",
        "invoiceTitle": "DELIVERY CHALLAN"
      }
    ],
    "completionDate": {
      "showCompletionDate": true,
      "label": "Completion Date",
      "defaultDate": 0
    },
    "otherOptions": {
      "disableTax": false,
      "disablePrice": true,
      "defaultProductNote": "Goods once sold cannot be returned."
    }
  },
  "purchaseOrder": {
    "otherOptions": {
      "showRemainingQtyProgress": true
    }
  }
}
```

### Get Document Options
```http
GET /api/document-options
Authorization: Bearer <token>
```
**Response**
```json
{
  "_id": "698484022a45ca2ccc9dd600",
  "userId": "GSTBILL7543354300",
  "saleInvoice": {
    "statusSettings": {
      "showStatus": true,
      "label": "Order Status",
      "options": [
        {
          "name": "Pending",
          "color": "Orange"
        }
      ]
    },
    "defaultOptions": {
      "sortBy": "Invoice No ( Ascending )",
      "defaultPaymentType": "CASH"
    },
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "name": "TAX INVOICE",
        "invoiceTitle": "TAX INVOICE",
        "prefix": "",
        "postfix": ""
      }
    ]
  },
  "deliveryChallan": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "name": "DELIVERY CHALLAN",
        "invoiceTitle": "DELIVERY CHALLAN"
      }
    ],
    "completionDate": {
      "showCompletionDate": true,
      "label": "Completion Date",
      "defaultDate": 0
    },
    "otherOptions": {
      "disableTax": false,
      "disablePrice": true,
      "defaultProductNote": "Goods once sold cannot be returned."
    }
  }
}
```


