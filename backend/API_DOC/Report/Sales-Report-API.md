# Sales Report API Documentation

## Overview

The Sales Report module provides comprehensive reporting capabilities for sales invoices with advanced filtering, grouping, and customization features.

## Base URL
```
/api/reports
```

## Authentication
All endpoints require authentication using the `protect` middleware. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## 1. Generate Sales Report

### Endpoint
```
POST /api/reports/sales
```

### Description
Generates a sales report based on provided filters and customization options. Supports advanced filtering, grouping, and column selection.

### Request Body

```json
{
    "filters": {
        "customerVendor": "Company Name",
        "products": ["Product A", "Product B"],
        "productGroup": ["Group 1", "Group 2"],
        "dateRange": {
            "from": "2024-01-01",
            "to": "2024-12-31"
        },
        "staffName": "John Doe",
        "invoiceNumber": "INV-001",
        "invoiceSeries": "INV",
        "serialNumber": "SN123456",
        "includeCancelled": false,
        "groupByCustomer": false,
        "groupByCurrency": false,
        "advanceFilters": [
            {
                "field": "totals.grandTotal",
                "operator": "greaterThan",
                "value": 1000
            },
            {
                "field": "invoiceDetails.date",
                "operator": "between",
                "value": ["2024-01-01", "2024-06-30"]
            }
        ],
        "selectedColumns": [
            "customerInformation.ms",
            "invoiceDetails.invoiceNumber",
            "invoiceDetails.date",
            "totals.grandTotal",
            "items.productName",
            "items.qty"
        ]
    },
    "options": {
        "page": 1,
        "limit": 50,
        "sortBy": "invoiceDetails.date",
        "sortOrder": "desc"
    }
}
```

### Request Parameters

#### Filters Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerVendor | string | false | Customer/Vendor name (contains search) |
| products | array | false | Array of product names |
| productGroup | array | false | Array of product groups |
| dateRange | object | false | Date range with from/to properties |
| staffName | string | false | Staff name (contains search) |
| invoiceNumber | string | false | Invoice number (contains search) |
| invoiceSeries | string | false | Invoice series/prefix (contains search) |
| serialNumber | string | false | Serial number (contains search) |
| includeCancelled | boolean | false | Include cancelled invoices (default: false) |
| groupByCustomer | boolean | false | Group results by customer (default: false) |
| groupByCurrency | boolean | false | Group by original currency (default: false) |
| advanceFilters | array | false | Array of advanced filter objects |
| selectedColumns | array | false | Array of columns to include in response |

#### Options Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | false | Page number (default: 1) |
| limit | number | false | Records per page (default: 50, max: 1000) |
| sortBy | string | false | Sort field (default: invoiceDetails.date) |
| sortOrder | string | false | Sort order: 'asc' or 'desc' (default: 'desc') |

#### Advanced Filter Object

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| field | string | true | Field name (e.g., "totals.grandTotal") |
| operator | string | true | Operator: 'equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'between' |
| value | mixed | true | Filter value (array for 'between' operator) |

#### Available Sort Fields

- `invoiceDetails.date`
- `invoiceDetails.invoiceNumber`
- `customerInformation.ms`
- `totals.grandTotal`
- `totals.totalTaxable`
- `createdAt`
- `updatedAt`

### Response

#### Success Response (200)
```json
{
    "success": true,
    "data": {
        "reports": [
            {
                "customerInformation": {
                    "ms": "Company Name",
                    "gstinPan": "27AAAPL1234C1ZY",
                    "address": "123 Main St",
                    "shipTo": "456 Shipping Ave"
                },
                "invoiceDetails": {
                    "invoiceNumber": "INV-001",
                    "date": "2024-01-15T00:00:00.000Z",
                    "invoiceType": "Tax Invoice",
                    "invoicePrefix": "INV"
                },
                "totals": {
                    "grandTotal": 15000,
                    "totalTaxable": 12712,
                    "totalTax": 2288,
                    "totalCGST": 1144,
                    "totalSGST": 1144,
                    "totalIGST": 0
                },
                "items": [
                    {
                        "productName": "Product A",
                        "hsnSac": "1234",
                        "productGroup": "Group 1",
                        "qty": 10,
                        "uom": "PCS",
                        "price": 1000,
                        "discount": 0,
                        "igst": 0,
                        "cgst": 90,
                        "sgst": 90,
                        "total": 10000,
                        "itemNote": "Special instructions"
                    }
                ],
                "paymentType": "CREDIT",
                "dueDate": "2024-02-14T00:00:00.000Z",
                "createdAt": "2024-01-15T10:30:00.000Z"
            }
        ],
        "pagination": {
            "currentPage": 1,
            "totalPages": 5,
            "totalRecords": 250,
            "recordsPerPage": 50
        }
    },
    "message": "Sales report generated successfully"
}
```

#### Grouped Response Example
```json
{
    "success": true,
    "data": {
        "reports": [
            {
                "customer": "Company A",
                "totalInvoices": 15,
                "totalGrandTotal": 150000,
                "totalTaxable": 127119,
                "totalTax": 22881,
                "totalQuantity": 500,
                "totalItems": 127119,
                "invoices": [
                    {
                        "invoiceDetails": {
                            "invoiceNumber": "INV-001",
                            "date": "2024-01-15T00:00:00.000Z"
                        },
                        "totals": {
                            "grandTotal": 10000
                        }
                    }
                ]
            }
        ],
        "pagination": {
            "currentPage": 1,
            "totalPages": 3,
            "totalRecords": 150,
            "recordsPerPage": 50
        }
    }
}
```

#### Error Response (400)
```json
{
    "success": false,
    "message": "Validation failed",
    "errors": [
        "Invalid date range \"from\" value",
        "Page must be a positive integer"
    ]
}
```

#### Error Response (500)
```json
{
    "success": false,
    "message": "Internal server error",
    "error": "Database query failed"
}
```

---

## 2. Get Filter Metadata

### Endpoint
```
GET /api/reports/sales/metadata
```

### Description
Retrieves available filter fields, operators, and column options for building the sales report UI.

### Request
No request body required.

### Response

#### Success Response (200)
```json
{
    "success": true,
    "data": {
        "filterFields": {
            "customerVendor": {
                "label": "Customer/Vendor",
                "type": "string",
                "field": "customerInformation.ms",
                "operators": ["equals", "contains"]
            },
            "products": {
                "label": "Products",
                "type": "array",
                "field": "items.productName",
                "operators": ["equals", "contains"]
            },
            "productGroup": {
                "label": "Product Group",
                "type": "array",
                "field": "items.productGroup",
                "operators": ["equals", "contains"]
            },
            "dateRange": {
                "label": "Date Range",
                "type": "daterange",
                "field": "invoiceDetails.date",
                "operators": ["between"]
            },
            "staffName": {
                "label": "Staff Name",
                "type": "string",
                "field": "staff.name",
                "operators": ["equals", "contains"]
            },
            "invoiceNumber": {
                "label": "Invoice Number",
                "type": "string",
                "field": "invoiceDetails.invoiceNumber",
                "operators": ["equals", "contains"]
            },
            "invoiceSeries": {
                "label": "Invoice Series",
                "type": "string",
                "field": "invoiceDetails.invoicePrefix",
                "operators": ["equals", "contains"]
            },
            "serialNumber": {
                "label": "Serial Number",
                "type": "string",
                "field": "serialNumber",
                "operators": ["equals", "contains"]
            }
        },
        "availableColumns": {
            "invoiceLevel": [
                {
                    "field": "customerInformation.ms",
                    "label": "Customer Name"
                },
                {
                    "field": "customerInformation.gstinPan",
                    "label": "GSTIN"
                },
                {
                    "field": "customerInformation.address",
                    "label": "Billing Address"
                },
                {
                    "field": "customerInformation.shipTo",
                    "label": "Shipping Address"
                },
                {
                    "field": "customerInformation.contactPerson",
                    "label": "Contact Person"
                },
                {
                    "field": "customerInformation.phone",
                    "label": "Phone"
                },
                {
                    "field": "invoiceDetails.invoiceNumber",
                    "label": "Invoice Number"
                },
                {
                    "field": "invoiceDetails.invoicePrefix",
                    "label": "Invoice Prefix"
                },
                {
                    "field": "invoiceDetails.date",
                    "label": "Invoice Date"
                },
                {
                    "field": "invoiceDetails.invoiceType",
                    "label": "Invoice Type"
                },
                {
                    "field": "invoiceDetails.deliveryMode",
                    "label": "Delivery Mode"
                },
                {
                    "field": "dueDate",
                    "label": "Due Date"
                },
                {
                    "field": "paymentType",
                    "label": "Payment Type"
                },
                {
                    "field": "bankDetails",
                    "label": "Bank Details"
                },
                {
                    "field": "termsTitle",
                    "label": "Terms Title"
                },
                {
                    "field": "termsDetails",
                    "label": "Terms Details"
                },
                {
                    "field": "additionalNotes",
                    "label": "Additional Notes"
                },
                {
                    "field": "documentRemarks",
                    "label": "Remarks"
                },
                {
                    "field": "totals.grandTotal",
                    "label": "Grand Total"
                },
                {
                    "field": "totals.totalTaxable",
                    "label": "Total Taxable"
                },
                {
                    "field": "totals.totalTax",
                    "label": "Total Tax"
                },
                {
                    "field": "totals.totalCGST",
                    "label": "Total CGST"
                },
                {
                    "field": "totals.totalSGST",
                    "label": "Total SGST"
                },
                {
                    "field": "totals.totalIGST",
                    "label": "Total IGST"
                },
                {
                    "field": "totals.roundOff",
                    "label": "Round Off"
                },
                {
                    "field": "totals.totalInvoiceValue",
                    "label": "Total Invoice Value"
                },
                {
                    "field": "createdAt",
                    "label": "Created At"
                },
                {
                    "field": "updatedAt",
                    "label": "Updated At"
                }
            ],
            "itemLevel": [
                {
                    "field": "items.productName",
                    "label": "Product Name"
                },
                {
                    "field": "items.hsnSac",
                    "label": "Product HSN"
                },
                {
                    "field": "items.productGroup",
                    "label": "Product Group"
                },
                {
                    "field": "items.qty",
                    "label": "Quantity"
                },
                {
                    "field": "items.uom",
                    "label": "UOM"
                },
                {
                    "field": "items.price",
                    "label": "Price"
                },
                {
                    "field": "items.discount",
                    "label": "Discount"
                },
                {
                    "field": "items.igst",
                    "label": "IGST"
                },
                {
                    "field": "items.cgst",
                    "label": "CGST"
                },
                {
                    "field": "items.sgst",
                    "label": "SGST"
                },
                {
                    "field": "items.total",
                    "label": "Item Total"
                },
                {
                    "field": "items.itemNote",
                    "label": "Item Note"
                }
            ]
        },
        "advanceFilterOperators": [
            { "value": "equals", "label": "Equals" },
            { "value": "notEquals", "label": "Not Equals" },
            { "value": "contains", "label": "Contains" },
            { "value": "greaterThan", "label": "Greater Than" },
            { "value": "lessThan", "label": "Less Than" },
            { "value": "between", "label": "Between" }
        ]
    },
    "message": "Filter metadata retrieved successfully"
}
```

---

## 3. Get Report Statistics

### Endpoint
```
POST /api/reports/sales/statistics
```

### Description
Retrieves statistical summary data for dashboard display. Supports optional filtering.

### Request Body

```json
{
    "filters": {
        "dateRange": {
            "from": "2024-01-01",
            "to": "2024-12-31"
        }
    }
}
```

### Response

#### Success Response (200)
```json
{
    "success": true,
    "data": {
        "totalInvoices": 150,
        "totalGrandTotal": 1500000,
        "totalTaxable": 1271190,
        "totalTax": 228810,
        "avgInvoiceValue": 10000
    },
    "message": "Report statistics retrieved successfully"
}
```

---

## Usage Examples

### Example 1: Basic Monthly Report

```javascript
const response = await fetch('/api/reports/sales', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            dateRange: {
                from: '2024-01-01',
                to: '2024-01-31'
            }
        },
        options: {
            page: 1,
            limit: 100,
            sortBy: 'invoiceDetails.date',
            sortOrder: 'desc'
        }
    })
});
```

### Example 2: Advanced Filter with Grouping

```javascript
const response = await fetch('/api/reports/sales', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            advanceFilters: [
                {
                    field: 'totals.grandTotal',
                    operator: 'greaterThan',
                    value: 5000
                }
            ],
            groupByCustomer: true,
            selectedColumns: [
                'customerInformation.ms',
                'totals.grandTotal',
                'invoiceDetails.date'
            ]
        }
    })
});
```

### Example 3: Product-Level Report

```javascript
const response = await fetch('/api/reports/sales', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            products: ['Product A', 'Product B'],
            selectedColumns: [
                'items.productName',
                'items.qty',
                'items.price',
                'items.total',
                'customerInformation.ms',
                'invoiceDetails.invoiceNumber'
            ]
        }
    })
});
```

---

## Error Handling

All endpoints follow consistent error handling:

- **200**: Success
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid/missing token)
- **500**: Server Error

### Error Response Format
```json
{
    "success": false,
    "message": "Error description",
    "errors": ["Detailed error messages"],
    "error": "Internal error details (development only)"
}
```

---

## Performance Considerations

1. **Pagination**: Always use pagination for large datasets
2. **Column Selection**: Use `selectedColumns` to limit data transfer
3. **Filter Optimization**: Use specific filters rather than broad searches
4. **Date Range**: Always specify date ranges for better performance
5. **Grouping**: Grouping reduces individual record processing

---

## Security Notes

1. **Authentication**: All endpoints require valid JWT token
2. **Authorization**: Users can only access their own data
3. **Input Validation**: All inputs are validated and sanitized
4. **Field Validation**: Advanced filters only work on allowed fields
5. **SQL Injection Prevention**: Uses MongoDB aggregation with parameterized queries

---

## Reset Functionality

The reset functionality is frontend-only and does not affect database data:

```javascript
// Frontend reset example
const resetFilters = () => {
    setFilters({
        customerVendor: '',
        products: [],
        productGroup: [],
        dateRange: null,
        staffName: '',
        invoiceNumber: '',
        invoiceSeries: '',
        serialNumber: '',
        includeCancelled: false,
        groupByCustomer: false,
        groupByCurrency: false,
        advanceFilters: [],
        selectedColumns: []
    });
};
```

---

## Default Behavior

When no `selectedColumns` are provided, the system returns default columns:

**Invoice Level Defaults:**
- Customer Name
- GSTIN
- Invoice Number
- Invoice Date
- Invoice Type
- Grand Total
- Total Taxable
- Total Tax
- Payment Type
- Created At

**Item Level Defaults (when product data is requested):**
- Product Name
- Product HSN
- Quantity
- Price
- Item Total
