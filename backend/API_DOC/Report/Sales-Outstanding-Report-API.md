# Sales Outstanding Report API

## Overview

The Sales Outstanding Report API provides comprehensive functionality for tracking and analyzing outstanding payments across all sales invoices. Built with horizontal scalability in mind, it supports up to 100 million users through optimized MongoDB aggregation pipelines, proper indexing strategies, and efficient query patterns.

## Features

- **Advanced Filtering**: Customer/vendor, product group, invoice details, due date ranges, due days ranges
- **Dynamic Grouping**: Group by due days, customer, or currency
- **Calculated Fields**: Days overdue, outstanding amounts, due categories
- **Customizable Columns**: Invoice-level and product-level column selection
- **Performance Optimized**: Lean queries, field whitelisting, cursor-based pagination ready
- **Secure**: JWT authentication with user data isolation

## Base URL

```
https://api.yourdomain.com/api/reports
```

## Authentication

All endpoints require JWT authentication:

```javascript
headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
}
```

## Endpoints

### 1. Generate Sales Outstanding Report

### Endpoint
```
POST /api/reports/sales-outstanding
```

### Description
Generate a comprehensive sales outstanding report with advanced filtering, grouping, and column customization.

### Request Body

```json
{
    "filters": {
        "customerVendor": "Company Name",
        "productGroup": ["Electronics", "Software"],
        "invoiceNumber": "INV-2024-001",
        "invoiceSeries": "INV-2024",
        "dueDateRange": {
            "from": "2024-01-01",
            "to": "2024-12-31"
        },
        "dueDaysRange": {
            "from": 0,
            "to": 90
        },
        "includePaid": false,
        "groupByDueDays": false,
        "groupByCustomer": false,
        "groupByCurrency": false,
        "advanceFilters": [
            {
                "field": "totals.grandTotal",
                "operator": "greaterThan",
                "value": 1000
            }
        ],
        "selectedColumns": [
            "customerInformation.ms",
            "invoiceDetails.invoiceNumber",
            "dueDate",
            "daysOverdue",
            "outstandingAmount"
        ]
    },
    "options": {
        "page": 1,
        "limit": 50,
        "sortBy": "dueDate",
        "sortOrder": "asc"
    }
}
```

### Filter Parameters

| Parameter | Type | Required | Description |
|-----------|--------|----------|-------------|
| `customerVendor` | string | No | Filter by customer/vendor name (contains) |
| `productGroup` | array | No | Filter by product groups |
| `invoiceNumber` | string | No | Filter by invoice number (contains) |
| `invoiceSeries` | string | No | Filter by invoice series/prefix (contains) |
| `dueDateRange` | object | No | Due date range with `from` and `to` properties |
| `dueDaysRange` | object | No | Due days range with `from` and `to` properties |
| `includePaid` | boolean | No | Include fully paid invoices (default: false) |
| `groupByDueDays` | boolean | No | Group results by due days categories |
| `groupByCustomer` | boolean | No | Group results by customer |
| `groupByCurrency` | boolean | No | Group results by currency |
| `advanceFilters` | array | No | Advanced dynamic filters array |
| `selectedColumns` | array | No | Specific columns to include in response |

### Options Parameters

| Parameter | Type | Default | Description |
|-----------|--------|----------|-------------|
| `page` | number | 1 | Page number for pagination |
| `limit` | number | 50 | Records per page (max: 1000) |
| `sortBy` | string | 'invoiceDetails.date' | Sort field |
| `sortOrder` | string | 'desc' | Sort order: 'asc' or 'desc' |

### Response

```json
{
    "success": true,
    "data": {
        "reports": [
            {
                "customerInformation": {
                    "ms": "Company A",
                    "gstinPan": "27AAAPL1234C1ZV",
                    "phone": "+91-9876543210"
                },
                "invoiceDetails": {
                    "invoiceNumber": "INV-2024-001",
                    "date": "2024-01-15T00:00:00.000Z",
                    "invoiceType": "Tax Invoice"
                },
                "dueDate": "2024-02-14T00:00:00.000Z",
                "daysOverdue": 30,
                "outstandingAmount": 15000.00,
                "dueDaysCategory": "31-60 Days",
                "totals": {
                    "grandTotal": 15000.00,
                    "totalTaxable": 12711.86,
                    "totalTax": 2288.14
                },
                "paymentType": "CREDIT",
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
    "message": "Sales outstanding report generated successfully"
}
```

### Grouped Response Example

```json
{
    "success": true,
    "data": {
        "reports": [
            {
                "customer": "Company A",
                "dueDaysCategory": "31-60 Days",
                "totalInvoices": 15,
                "totalGrandTotal": 225000.00,
                "totalOutstanding": 150000.00,
                "avgDaysOverdue": 45.5,
                "maxDaysOverdue": 60,
                "invoices": [
                    {
                        "invoiceDetails": {
                            "invoiceNumber": "INV-2024-001"
                        },
                        "outstandingAmount": 10000.00
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

### Error Response

```json
{
    "success": false,
    "message": "Validation failed",
    "errors": [
        "Invalid due date range start date",
        "Due days range start must be less than or equal to end"
    ]
}
```

---

## 2. Get Filter Metadata

### Endpoint
```
GET /api/reports/sales-outstanding/metadata
```

### Description
Retrieves available filter fields, operators, column options, and grouping configurations for building the sales outstanding report UI.

### Response

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
            "productGroup": {
                "label": "Product Group",
                "type": "array",
                "field": "items.productGroup",
                "operators": ["equals", "contains"]
            },
            "dueDateRange": {
                "label": "Due Date Range",
                "type": "daterange",
                "field": "dueDate",
                "operators": ["between"]
            },
            "dueDaysRange": {
                "label": "Due Days Range",
                "type": "numberrange",
                "field": "daysOverdue",
                "operators": ["between"]
            }
        },
        "availableColumns": {
            "invoiceLevel": [
                {
                    "field": "customerInformation.ms",
                    "label": "Customer Name"
                },
                {
                    "field": "dueDate",
                    "label": "Due Date"
                },
                {
                    "field": "daysOverdue",
                    "label": "Days Overdue"
                },
                {
                    "field": "outstandingAmount",
                    "label": "Outstanding Amount"
                }
            ],
            "itemLevel": [
                {
                    "field": "items.productName",
                    "label": "Product Name"
                },
                {
                    "field": "items.qty",
                    "label": "Quantity"
                }
            ]
        },
        "advanceFilterOperators": [
            {
                "value": "equals",
                "label": "Equals"
            },
            {
                "value": "greaterThan",
                "label": "Greater Than"
            },
            {
                "value": "between",
                "label": "Between"
            }
        ],
        "groupingOptions": [
            {
                "value": "groupByDueDays",
                "label": "Group by Due Days"
            },
            {
                "value": "groupByCustomer",
                "label": "Group by Customer"
            }
        ]
    },
    "message": "Filter metadata retrieved successfully"
}
```

---

## 3. Get Outstanding Statistics

### Endpoint
```
POST /api/reports/sales-outstanding/statistics
```

### Description
Retrieves aggregated statistics for outstanding payments, ideal for dashboard widgets and KPI tracking.

### Request Body

```json
{
    "filters": {
        "dueDateRange": {
            "from": "2024-01-01",
            "to": "2024-12-31"
        }
    }
}
```

### Response

```json
{
    "success": true,
    "data": {
        "totalInvoices": 1250,
        "totalGrandTotal": 5250000.00,
        "totalOutstanding": 1875000.00,
        "avgDaysOverdue": 35.7,
        "criticalOverdue": 180,
        "overdueInvoices": 420
    },
    "message": "Outstanding statistics retrieved successfully"
}
```

### Statistics Fields

| Field | Type | Description |
|--------|--------|-------------|
| `totalInvoices` | number | Total number of invoices matching filters |
| `totalGrandTotal` | number | Sum of all invoice totals |
| `totalOutstanding` | number | Total outstanding amount remaining |
| `avgDaysOverdue` | number | Average days overdue across all invoices |
| `criticalOverdue` | number | Number of invoices overdue by 90+ days |
| `overdueInvoices` | number | Number of invoices with any overdue amount |

---

## Usage Examples

### Example 1: Basic Outstanding Report

```javascript
const response = await fetch('/api/reports/sales-outstanding', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            dueDateRange: {
                from: '2024-01-01',
                to: '2024-01-31'
            }
        },
        options: {
            page: 1,
            limit: 25,
            sortBy: 'daysOverdue',
            sortOrder: 'desc'
        }
    })
});

const result = await response.json();
console.log(result.data.reports); // Outstanding invoices
```

### Example 2: Grouped by Due Days

```javascript
const response = await fetch('/api/reports/sales-outstanding', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            groupByDueDays: true,
            dueDaysRange: {
                from: 1
            }
        },
        options: {
            sortBy: 'dueDaysCategory',
            sortOrder: 'asc'
        }
    })
});
```

### Example 3: Advanced Filtering

```javascript
const response = await fetch('/api/reports/sales-outstanding', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            customerVendor: 'Acme Corp',
            advanceFilters: [
                {
                    field: 'outstandingAmount',
                    operator: 'greaterThan',
                    value: 5000
                },
                {
                    field: 'daysOverdue',
                    operator: 'between',
                    value: [30, 90]
                }
            ],
            selectedColumns: [
                'customerInformation.ms',
                'invoiceDetails.invoiceNumber',
                'dueDate',
                'daysOverdue',
                'outstandingAmount',
                'totals.grandTotal'
            ]
        }
    })
});
```

### Example 4: Dashboard Statistics

```javascript
const response = await fetch('/api/reports/sales-outstanding/statistics', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filters: {
            dueDaysRange: {
                from: 1
            }
        }
    })
});

const stats = await response.json();
console.log(`Total Outstanding: $${stats.data.totalOutstanding.toLocaleString()}`);
console.log(`Critical Overdue: ${stats.data.criticalOverdue} invoices`);
```

---

## Performance Considerations

### Database Indexing

For optimal performance with large datasets, ensure these indexes exist:

```javascript
// User data isolation
db.saleinvoices.createIndex({ "userId": 1 })

// Customer filtering
db.saleinvoices.createIndex({ "userId": 1, "customerInformation.ms": 1 })

// Due date filtering
db.saleinvoices.createIndex({ "userId": 1, "dueDate": 1 })

// Invoice number filtering
db.saleinvoices.createIndex({ "userId": 1, "invoiceDetails.invoiceNumber": 1 })

// Compound index for common queries
db.saleinvoices.createIndex({ 
    "userId": 1, 
    "dueDate": 1, 
    "customerInformation.ms": 1 
})
```

### Query Optimization

- **Lean Projections**: Only requested fields are returned
- **Field Whitelisting**: Prevents unauthorized field access
- **Parallel Execution**: Count and data queries run concurrently
- **Cursor-Based Ready**: Pipeline structure supports cursor pagination
- **Disk Use Enabled**: Handles large aggregation results

### Scalability Features

- **User Isolation**: All queries filtered by `userId`
- **Pagination**: Efficient skip/limit with configurable page sizes
- **Aggregation Pipeline**: Optimized for MongoDB performance
- **Memory Efficient**: Lean queries with minimal data transfer

---

## Security Notes

### Authentication

- All endpoints require valid JWT token
- Token must be passed in `Authorization: Bearer <token>` header
- Tokens automatically expire based on configuration

### Data Isolation

- All queries automatically filtered by authenticated user's ID
- Users can only access their own invoice data
- No cross-user data leakage possible

### Input Validation

- All filter fields validated against whitelist
- SQL/NoSQL injection protection through MongoDB operators
- Date ranges validated for proper format
- Numeric ranges validated for bounds

### Rate Limiting

Consider implementing rate limiting for:
- Report generation endpoints
- Large data exports
- Concurrent report requests

---

## Error Handling

### HTTP Status Codes

| Status | Description |
|---------|-------------|
| `200` | Success |
| `400` | Validation Error |
| `401` | Unauthorized |
| `403` | Forbidden |
| `500` | Internal Server Error |

### Error Response Format

```json
{
    "success": false,
    "message": "Error description",
    "errors": ["Specific validation errors"],
    "error": "Technical error details (development only)"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|--------|----------|
| `Validation failed` | Invalid filter parameters | Check request body format |
| `Unauthorized` | Invalid/expired token | Refresh authentication |
| `Internal server error` | Database/query issues | Check server logs |

---

## SDK Examples

### JavaScript/Node.js

```javascript
class OutstandingReportAPI {
    constructor(baseURL, token) {
        this.baseURL = baseURL;
        this.token = token;
    }

    async getOutstandingReport(filters = {}, options = {}) {
        const response = await fetch(`${this.baseURL}/api/reports/sales-outstanding`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filters, options })
        });
        return response.json();
    }

    async getMetadata() {
        const response = await fetch(`${this.baseURL}/api/reports/sales-outstanding/metadata`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });
        return response.json();
    }

    async getStatistics(filters = {}) {
        const response = await fetch(`${this.baseURL}/api/reports/sales-outstanding/statistics`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ filters })
        });
        return response.json();
    }
}

// Usage
const api = new OutstandingReportAPI('https://api.yourdomain.com', token);

// Get overdue invoices
const overdue = await api.getOutstandingReport({
    dueDaysRange: { from: 1 }
}, { limit: 100 });

// Get statistics
const stats = await api.getStatistics();
```

---

## Version History

### v1.0.0
- Initial release with basic outstanding reporting
- Advanced filtering and grouping support
- Performance optimizations for large datasets
- Comprehensive API documentation

---

## Support

For technical support and API questions:
- Documentation: [API Documentation Portal]
- Support: [Support Email]
- Status: [API Status Page]

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
**Note**: `reportType` must be set to `sales-outstanding`.

```json
{
  "reportType": "sales-outstanding", 

  "filters": {
    "customerVendor": "", // Optional
    "dueDateRange": {
      "from": "2026-02-01",
      "to": "2026-02-28"
    }
  },
  "options": {
    "page": 1,
    "limit": 50,
    "sortBy": "daysOverdue", // Default
    "sortOrder": "desc" // asc | desc
  },

  "reportTitle": "Sales Outstanding Report",
  
  // For Email Action Only
  "email": "user@example.com",
  "message": "Please find attached report."
}
```
