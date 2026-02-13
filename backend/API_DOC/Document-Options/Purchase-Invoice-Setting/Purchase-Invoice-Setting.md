**Base URL**: `http://localhost:5000/api`

## Purchase Invoice Settings (Document Options)

Purchase Invoice settings are part of the global **Document Options** API. These settings control the behavior, numbering series, status options, and other defaults for Purchase Invoice documents.

### Get Purchase Invoice Settings
`GET` /api/document-options
- **Description**: Retrieves all document options. The Purchase Invoice settings are located under the `purchaseInvoice` key in the response object.

### Update Purchase Invoice Settings
`POST` /api/document-options
- **Description**: Updates the Purchase Invoice settings. You should send the `purchaseInvoice` object within the request body. Partial updates to the `documentOptions` document are supported.

#### Payload Structure (Purchase Invoice)

```json
{
  "purchaseInvoice": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "invoiceName": "Main Series",
        "invoiceTitle": "PURCHASE INVOICE",
        "prefix": "PI-",
        "postfix": ""
      }
    ],
    "statusSettings": {
      "showStatus": true,
      "label": "Status",
      "options": [
        { "name": "New", "color": "Davy's-Gray" },
        { "name": "Paid", "color": "Green" },
        { "name": "Pending", "color": "Orange" }
      ]
    },
    "completionDate": {
      "showCompletionDate": true,
      "label": "Due Date",
      "defaultDate": 30
    },
    "otherOptions": {
      "printAsSaleInvoiceReceived": false,
      "defaultProductNote": "",
      "defaultPaymentType": "CREDIT"
    }
  }
}
```

#### Field Descriptions

| Field | Type | Description |
| :--- | :--- | :--- |
| **invoiceSeries** | Array | List of numbering series configurations. |
| `seriesType` | String | Type of series (`Default`, `Import`, `Custom`). |
| `prefix` / `postfix` | String | String to prepend/append to the generated number. |
| **statusSettings** | Object | Configuration for document statuses. |
| `showStatus` | Boolean | Whether to show the status column/field. |
| `options` | Array | List of options. Each object has `name` (String) and `color` (String). |
| **otherOptions** | Object | Miscellaneous settings. |
| `printAsSaleInvoiceReceived` | Boolean | Toggle to print in a specific format (if supported). |
| `defaultProductNote` | String | Default note text for products in this document type. |
| `defaultPaymentType` | String | Default payment type. Enum: `NONE`, `CREDIT`, `CASH`, `CHEQUE`, `ONLINE`. |

### Status Colors
The `color` field in `statusSettings.options` supports the following enum values:
- `Red`, `Orange`, `Yellow`, `Green`
- `Red-Wood`, `Burnt umber`, `Russet`, `Coyote`, `Raw-Umber`, `Olive`
- `Moss-Green`, `Old-Gold`, `Fern-Green`, `Avocado`, `Jungle-Green`, `Kelly-Green`
- `Viridian`, 'Verdigris', `Steel-Blue`, `Light-Coyote`, `Davy's-Gray`, `Mountbatten pink`
