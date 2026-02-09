**Base URL**: `http://localhost:5000/api`

## Job Work Settings (Document Options)

Job Work settings are part of the global **Document Options** API. These settings control the behavior, numbering series, and status options for Job Work documents.

### Get Job Work Settings
`GET` /api/document-options
- **Description**: Retrieves all document options. The Job Work settings are located under the `jobWork` key in the response object.

### Update Job Work Settings
`POST` /api/document-options
- **Description**: Updates the Job Work settings. You should send the `jobWork` object within the request body. Partial updates to the `documentOptions` document are supported.

#### Payload Structure (Job Work)

```json
{
  "jobWork": {
    "invoiceSeries": [
      {
        "seriesType": "Default",
        "enabled": true,
        "invoiceName": "Main Series",
        "invoiceTitle": "JOB WORK",
        "prefix": "JW-",
        "postfix": ""
      }
    ],
    "statusSettings": {
      "showStatus": true,
      "label": "Status",
      "options": [
        { "name": "New", "color": "Davy's-Gray" },
        { "name": "Pending", "color": "Orange" },
        { "name": "In-Work", "color": "Yellow" },
        { "name": "Completed", "color": "Green" },
        { "name": "Cancelled", "color": "Red" }
      ]
    },
    "completionDate": {
      "showCompletionDate": true,
      "label": "Completion Date",
      "defaultDate": 15
    },
    "otherOptions": {
      "disableTax": false,
      "disablePrice": false,
      "defaultProductNote": ""
    }
  }
}
```

#### Field Descriptions

| Field | Type | Description |
| :--- | :--- | :--- |
| **invoiceSeries** | Array | List of numbering series configurations. |
| `seriesType` | String | Type of series (`Default`, `Export`, `Custom`). |
| `prefix` / `postfix` | String | String to prepend/append to the generated number. |
| **statusSettings** | Object | Configuration for document statuses. |
| `showStatus` | Boolean | Whether to show the status column/field. |
| `options` | Array | List of available statuses. Each object has `name` (String) and `color` (String). |
| **completionDate** | Object | Settings for the "Completion Date" field. |
| `defaultDate` | Number | Number of days from creation to set as default completion date. |
| **otherOptions** | Object | Miscellaneous switches. |
| `disableTax` | Boolean | If true, tax columns are hidden/disabled in the UI. |
| `disablePrice` | Boolean | If true, price columns are hidden/disabled. |

### Status Colors
The `color` field in `statusSettings.options` supports the following enum values:
- `Red`, `Orange`, `Yellow`, `Green`
- `Red-Wood`, `Burnt umber`, `Russet`, `Coyote`, `Raw-Umber`, `Olive`
- `Moss-Green`, `Old-Gold`, `Fern-Green`, `Avocado`, `Jungle-Green`, `Kelly-Green`
- `Viridian`, 'Verdigris', `Steel-Blue`, `Light-Coyote`, `Davy's-Gray`, `Mountbatten pink`
