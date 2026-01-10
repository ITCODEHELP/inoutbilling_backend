# Sales Product Report API

## Overview

The Sales Product Report API provides comprehensive product-wise sales reporting with advanced filtering, grouping, and search capabilities. This API allows users to analyze sales data by products with various aggregation options and detailed filtering.

## Features

- **Advanced Filtering**: Filter by customer/vendor, products, product groups, staff name, invoice details, and date ranges
- **Flexible Grouping**: Group products by title with GST%, HSN, HSN with GST%, or title with HSN with GST%
- **Dynamic Filters**: Support for custom field-based filters with various operators
- **UOM Support**: Option to include primary unit of measurement in results
- **Pagination**: Built-in result limiting for large datasets
- **Real-time Search**: Efficient MongoDB aggregation for fast query performance

## Authentication

All endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### 1. Search Sales Product Report

**GET** `/api/reports/sales-product`

Fetch sales product report data with advanced filtering and grouping options.

#### Request Body

```json
{
  "customerVendor": "string",
  "products": ["string"],
  "productGroup": ["string"],
  "staffName": "string",
  "invoiceNumber": "string",
  "invoiceSeries": "string",
  "groupProductBy": "Title with GST%",
  "fromDate": "2024-01-01",
  "toDate": "2024-12-31",
  "showPrimaryUOM": true,
  "advanceFilters": [
    {
      "field": "items.total",
      "operator": "greaterThan",
      "value": 1000
    }
  ],
  "limit": 100
}
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerVendor` | string | No | Filter by customer/vendor name (partial match) |
| `products` | array | No | Array of product names to filter by |
| `productGroup` | array | No | Array of product groups to filter by |
| `staffName` | string | No | Filter by staff name (partial match) |
| `invoiceNumber` | string | No | Filter by invoice number (partial match) |
| `invoiceSeries` | string | No | Filter by invoice series/prefix (partial match) |
| `groupProductBy` | string | No | Grouping option (default: "Title with GST%") |
| `fromDate` | string | No | Start date for date range filter (YYYY-MM-DD) |
| `toDate` | string | No | End date for date range filter (YYYY-MM-DD) |
| `showPrimaryUOM` | boolean | No | Include primary UOM in results (default: false) |
| `advanceFilters` | array | No | Array of custom filter objects |
| `limit` | number | No | Maximum number of results to return |

#### Grouping Options

- `"Title with GST%"` - Group by product name and calculated GST percentage
- `"HSN"` - Group by HSN/SAC code
- `"HSN with GST%"` - Group by HSN code and calculated GST percentage
- `"Title with HSN with GST%"` - Group by product name, HSN code, and GST percentage

#### Advanced Filters

Each advanced filter object supports:

| Field | Type | Description |
|-------|------|-------------|
| `field` | string | Field to filter on (e.g., "items.total", "items.qty") |
| `operator` | string | Comparison operator |
| `value` | string/number | Filter value |

#### Available Operators

- `"equals"` - Exact match
- `"notEquals"` - Not equal to
- `"greaterThan"` - Greater than
- `"lessThan"` - Less than
- `"greaterThanOrEqual"` - Greater than or equal to
- `"lessThanOrEqual"` - Less than or equal to
- `"contains"` - Contains substring (case-insensitive)

#### Available Fields for Advanced Filters

- `items.productName` - Product name
- `items.total` - Item total amount
- `items.qty` - Item quantity
- `items.price` - Item price
- `items.totalTax` - Item tax amount
- `customerInformation.ms` - Customer name
- `invoiceDetails.invoiceNumber` - Invoice number
- `invoiceDetails.date` - Invoice date

#### Response

```json
{
  "success": true,
  "data": [
    {
      "productName": "Product A",
      "hsnSac": "1234",
      "gstPercentage": 18.5,
      "totalQuantity": 150,
      "totalAmount": 15000,
      "totalTax": 2775,
      "avgPrice": 100,
      "invoiceCount": 25,
      "primaryUOM": "PCS"
    }
  ],
  "count": 1,
  "message": "Sales product report retrieved successfully"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `productName` | string | Product name (if grouped by product) |
| `hsnSac` | string | HSN/SAC code (if grouped by HSN) |
| `gstPercentage` | number | Calculated GST percentage |
| `totalQuantity` | number | Total quantity sold |
| `totalAmount` | number | Total amount (excluding tax) |
| `totalTax` | number | Total tax amount |
| `avgPrice` | number | Average price per unit |
| `invoiceCount` | number | Number of invoices |
| `primaryUOM` | string | Primary unit of measurement (if requested) |

### 2. Get Filter Metadata

**GET** `/api/reports/sales-product/metadata`

Get available filter options, grouping options, and field metadata for building the search interface.

#### Response

```json
{
  "success": true,
  "data": {
    "groupingOptions": [
      "Title with GST%",
      "HSN",
      "HSN with GST%",
      "Title with HSN with GST%"
    ],
    "operators": [
      "equals",
      "notEquals",
      "greaterThan",
      "lessThan",
      "greaterThanOrEqual",
      "lessThanOrEqual",
      "contains"
    ],
    "availableFields": [
      "items.productName",
      "items.total",
      "items.qty",
      "items.price",
      "items.totalTax",
      "customerInformation.ms",
      "invoiceDetails.invoiceNumber",
      "invoiceDetails.date"
    ]
  },
  "message": "Filter metadata retrieved successfully"
}
```

## Error Handling

### Common Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "message": "Not authorized, token failed"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Internal server error",
  "error": "Detailed error message (development only)"
}
```

#### Validation Errors
```json
{
  "success": false,
  "message": "Validation failed",
  "error": "Invalid filter parameters"
}
```

## Usage Examples

### Example 1: Basic Product Search

```javascript
const response = await fetch('/api/reports/sales-product', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    groupProductBy: 'Title with GST%',
    fromDate: '2024-01-01',
    toDate: '2024-12-31',
    limit: 50
  })
});
```

### Example 2: Advanced Filtering

```javascript
const response = await fetch('/api/reports/sales-product', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    customerVendor: 'Acme Corp',
    groupProductBy: 'HSN with GST%',
    showPrimaryUOM: true,
    advanceFilters: [
      {
        field: 'items.total',
        operator: 'greaterThan',
        value: 1000
      },
      {
        field: 'items.qty',
        operator: 'greaterThanOrEqual',
        value: 10
      }
    ],
    limit: 100
  })
});
```

### Example 3: Get Filter Metadata

```javascript
const response = await fetch('/api/reports/sales-product/metadata', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer ' + token
  }
});

const metadata = await response.json();
// Use metadata to build filter UI
```

## Performance Considerations

- **Indexing**: The API utilizes existing indexes on `userId`, `invoiceDetails.date`, and text search fields
- **Aggregation**: Uses optimized MongoDB aggregation pipelines for efficient data processing
- **Pagination**: Use the `limit` parameter to control result size for better performance
- **Date Range**: Always specify date range filters for better query performance

## Rate Limiting

The API respects the application's rate limiting policies. Excessive requests may be throttled.

## Support

For API support and questions, contact the development team or refer to the main API documentation.

---

*Last updated: January 2024*
