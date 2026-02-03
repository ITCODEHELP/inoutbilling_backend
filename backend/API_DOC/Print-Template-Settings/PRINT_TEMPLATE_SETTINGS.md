**Base URL**: `http://localhost:5000/api`

## Print Template Settings

### Get Document Types
```http
GET /api/print-template-settings/document-types
Authorization: Bearer <token>
```

### Get Available Templates
```http
GET /api/print-template-settings/templates
Authorization: Bearer <token>
```

### Get Saved Configs
```http
GET /api/print-template-settings?branchId=main
Authorization: Bearer <token>
```

### Get Config by Doc Type
```http
GET /api/print-template-settings/document/Sale%20Invoice?branchId=main
Authorization: Bearer <token>
```

### Save Configs
```http
POST /api/print-template-settings
Authorization: Bearer <token>
Content-Type: application/json
```
**Body**
```json
{
  "branchId": "main",
  "templateConfigurations": [
    { 
      "documentType": "Sale Invoice", 
      "selectedTemplate": "Designed", 
      "printSize": "A4",
      "printOrientation": "Portrait"
    }
  ]
}
```

## High-Fidelity PDF Generation
The system now uses Puppeteer for high-fidelity HTML to PDF conversion. All document templates (Sale Invoice, Quotation, Proforma, etc.) are rendered in a headless browser to ensure perfect layout, styles, and font preservation.

### Features:
- **Exact Browser Fidelity**: Preserves all CSS3, Web Fonts, and Image formatting.
- **Dynamic Orientation**: Supports `Portrait` and `Landscape` modes.
- **Flexible Print Sizes**: Supports `A4`, `A5`, and `Letter` formats.
- **Multi-Copy Support**: Correctly renders Original, Duplicate, Triplicate, and Office copies in a single PDF stream.

