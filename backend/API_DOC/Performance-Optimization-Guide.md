# Performance Optimization Guide

## Overview

This guide covers the comprehensive performance optimizations implemented to support 100+ million users with horizontal scalability, low-latency responses, and efficient resource utilization.

## Architecture Overview

### Multi-Tenant Isolation
- **User-based data isolation** with optimized indexing
- **JWT authentication** with caching and rate limiting
- **Secure query patterns** preventing cross-user data access

### Performance Layers
1. **Application Layer**: Caching, validation, rate limiting
2. **Database Layer**: Optimized queries, indexing, lean projections
3. **Infrastructure Layer**: Monitoring, metrics, horizontal scaling

## Database Optimization

### Indexing Strategy

#### User Collection
```javascript
// Primary lookup indexes
{ phone: 1 }                    // Unique
{ userId: 1 }                   // Unique
{ email: 1 }                    // Unique, sparse

// Compound indexes for common queries
{ phone: 1, countryCode: 1 }
{ userId: 1, isVerified: 1 }
{ createdAt: 1 }

// Text search
{ companyName: 'text', gstNumber: 'text' }
```

#### SaleInvoice Collection
```javascript
// Multi-tenant primary index
{ userId: 1 }

// Compound indexes for common queries
{ userId: 1, 'invoiceDetails.date': -1 }
{ userId: 1, dueDate: 1 }
{ userId: 1, 'customerInformation.ms': 1 }
{ userId: 1, 'invoiceDetails.invoiceNumber': 1 }

// Invoice-specific indexes
{ 'invoiceDetails.invoiceNumber': 1 }  // Unique
{ 'invoiceDetails.date': -1 }
{ dueDate: 1 }
{ paymentType: 1 }

// Text search
{ 'customerInformation.ms': 'text', 'customerInformation.gstinPan': 'text' }
{ 'items.productName': 'text' }
```

### Query Optimization

#### Lean Projections
```javascript
// Before: Returns full document
const user = await User.findById(id);

// After: Lean projection with specific fields
const user = await User.findById(id).select('userId phone email isVerified').lean();
```

#### Optimized Aggregation Pipelines
```javascript
// Always filter by userId first for performance
const pipeline = [
    { $match: { userId: userId } },  // First stage reduces dataset
    { $match: { 'invoiceDetails.date': { $gte: startDate } } },
    { $sort: { 'invoiceDetails.date': -1 } },
    { $skip: skip },
    { $limit: limit }
];

// Add allowDiskUse for large datasets
pipeline.push({ $allowDiskUse: true });
```

#### Parallel Query Execution
```javascript
// Execute multiple queries in parallel
const [invoices, count, summary] = await Promise.all([
    SaleInvoice.find(query).lean(),
    SaleInvoice.countDocuments(query),
    SaleInvoice.aggregate(summaryPipeline)
]);
```

## Caching Strategy

### Multi-Level Caching

#### 1. Application-Level Cache
```javascript
const cacheManager = getCacheManager();

// Cache user data for 5 minutes
await cacheManager.set(`user:${userId}`, userData, 300000);

// Cache with automatic invalidation
await cacheManager.set(`invoice:${invoiceId}`, invoiceData, 600000);
```

#### 2. Query Result Caching
```javascript
const cacheKey = cacheManager.generateKey('report', { filters, options }, userId);

// Try cache first
let cachedResult = await cacheManager.get(cacheKey);
if (cachedResult) return cachedResult;

// Execute query and cache result
const result = await executeReportQuery(filters, options);
await cacheManager.set(cacheKey, result, 300000);
```

#### 3. Cache Invalidation
```javascript
// Automatic invalidation on data changes
userSchema.post('save', function(doc) {
    cacheManager.invalidatePattern(`user:${doc._id}:*`);
    cacheManager.invalidatePattern(`user:${doc.phone}:*`);
});
```

### Cache Configuration
- **Memory Cache**: Fallback for development/small deployments
- **Redis Cache**: Production with persistence and clustering
- **TTL Strategy**: 5 minutes for user data, 10 minutes for reports
- **Cache Keys**: Hashed with user isolation for security

## Security & Validation

### Input Validation
```javascript
const validationSchema = {
    phone: {
        type: 'phone',
        required: true,
        maxLength: 20
    },
    email: {
        type: 'email',
        required: false,
        maxLength: 255
    }
};

const validation = SecurityValidation.validateInput(input, validationSchema);
if (!validation.isValid) {
    return res.status(400).json({ errors: validation.errors });
}
```

### Injection Protection
```javascript
// Automatic SQL/NoSQL injection detection
const isSafe = SecurityValidation.isSafeFromInjection(userInput);
if (!isSafe) {
    return res.status(400).json({ message: 'Invalid input detected' });
}
```

### XSS Protection
```javascript
// Automatic HTML sanitization
const sanitized = SecurityValidation.sanitizeHTML(userInput);
```

## Rate Limiting

### Multi-Tier Rate Limiting
```javascript
// Global rate limiting (100 requests/minute)
const globalResult = await SecurityValidation.checkRateLimit(
    `global:${clientIP}`, 100, 60000
);

// Endpoint-specific rate limiting
const otpResult = await SecurityValidation.checkRateLimit(
    `otp:${phone}`, 5, 300000  // 5 OTPs per 5 minutes
);

// User-specific rate limiting
const userResult = await SecurityValidation.checkRateLimit(
    `user:${userId}`, 1000, 3600000  // 1000 requests per hour
);
```

## Performance Monitoring

### Metrics Collection
```javascript
const monitor = getPerformanceMonitor();

// Automatic request tracking
app.use(performanceMiddleware(monitor));

// Manual query tracking
const startTime = Date.now();
await someDatabaseQuery();
monitor.trackQuery('find', 'users', Date.now() - startTime, { userId });
```

### Key Metrics
- **Response Time**: Average, P95, P99
- **Throughput**: Requests per second
- **Error Rate**: Percentage of failed requests
- **Database Performance**: Query times, slow queries
- **Cache Performance**: Hit rate, miss rate
- **System Resources**: Memory, CPU usage

### Alerting
```javascript
monitor.on('slow-request', (data) => {
    console.warn(`Slow request: ${data.method} ${data.route} took ${data.responseTime}ms`);
});

monitor.on('slow-query', (data) => {
    console.error(`Slow query: ${data.operation} on ${data.collection} took ${data.queryTime}ms`);
});
```

## Horizontal Scaling

### Load Balancing
- **Application Layer**: Multiple Node.js instances
- **Database Layer**: MongoDB replica sets with read preference
- **Cache Layer**: Redis clustering for high availability

### Database Sharding (Future)
```javascript
// Shard key strategy for 100M+ users
const shardKey = {
    userId: 1  // Distribute users across shards
};

// Shard collections
db.users.createIndex({ userId: 1 }, { shardKey: { userId: 1 } });
db.saleinvoices.createIndex({ userId: 1 }, { shardKey: { userId: 1 } });
```

### Connection Pooling
```javascript
// MongoDB connection pool configuration
const mongoOptions = {
    maxPoolSize: 50,        // Maximum connections
    minPoolSize: 5,         // Minimum connections
    maxIdleTimeMS: 30000,   // Close idle connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
};
```

## API Optimization Guidelines

### 1. Request/Response Optimization
```javascript
// Use lean queries for API responses
const users = await User.find({ userId }).lean();

// Select only required fields
const user = await User.findById(id).select('userId phone email').lean();

// Use pagination for large datasets
const page = Math.max(1, parseInt(req.query.page) || 1);
const limit = Math.min(100, parseInt(req.query.limit) || 50);
const skip = (page - 1) * limit;
```

### 2. Parallel Processing
```javascript
// Execute independent operations in parallel
const [userData, invoiceCount, recentInvoices] = await Promise.all([
    User.findById(userId).lean(),
    SaleInvoice.countDocuments({ userId }),
    SaleInvoice.find({ userId }).sort({ createdAt: -1 }).limit(5).lean()
]);
```

### 3. Cursor-Based Pagination
```javascript
// For large datasets, use cursor-based pagination
const cursor = req.query.cursor ? JSON.parse(req.query.cursor) : null;
const query = cursor 
    ? { _id: { $gt: cursor._id }, userId }
    : { userId };

const results = await Model.find(query)
    .sort({ _id: 1 })
    .limit(50)
    .lean();

const nextCursor = results.length > 0 
    ? { _id: results[results.length - 1]._id }
    : null;
```

## Deployment Optimization

### Environment Configuration
```javascript
// Production environment settings
const config = {
    node_env: 'production',
    cluster_mode: true,
    workers: require('os').cpus().length,
    cache: {
        type: 'redis',
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        cluster: true
    },
    database: {
        uri: process.env.MONGODB_URI,
        options: {
            maxPoolSize: 50,
            readPreference: 'secondaryPreferred'
        }
    }
};
```

### Memory Management
```javascript
// Monitor memory usage
setInterval(() => {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('High memory usage detected:', memUsage);
        // Trigger garbage collection if needed
        if (global.gc) global.gc();
    }
}, 30000);
```

### Graceful Shutdown
```javascript
process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    
    // Stop accepting new requests
    server.close();
    
    // Close database connections
    await mongoose.connection.close();
    
    // Clear cache
    await cacheManager.clear();
    
    process.exit(0);
});
```

## Performance Testing

### Load Testing Script
```javascript
// Example load test using Artillery or similar
const config = {
    config: {
        target: 'http://localhost:5000',
        phases: [
            { duration: 60, arrivalRate: 10 },
            { duration: 120, arrivalRate: 50 },
            { duration: 60, arrivalRate: 100 }
        ]
    },
    scenarios: [
        {
            name: 'API Load Test',
            weight: 100,
            flow: [
                { post: { url: '/api/auth/login' } },
                { get: { url: '/api/reports/sales' } }
            ]
        }
    ]
};
```

### Benchmark Targets
- **Response Time**: < 200ms (P95)
- **Throughput**: > 1000 RPS per instance
- **Error Rate**: < 0.1%
- **Memory Usage**: < 500MB per instance
- **CPU Usage**: < 70% average

## Monitoring & Alerting

### Health Check Endpoint
```javascript
app.get('/health', async (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        cache: cacheManager ? 'connected' : 'disconnected'
    };
    
    res.json(health);
});
```

### Metrics Dashboard
- **Real-time metrics**: Response times, error rates
- **System metrics**: CPU, memory, disk usage
- **Database metrics**: Connection pool, query performance
- **Cache metrics**: Hit rates, eviction rates

## Best Practices

### 1. Code Optimization
- Use async/await consistently
- Implement proper error handling
- Avoid blocking operations
- Use streaming for large data transfers

### 2. Database Optimization
- Always filter by userId first in multi-tenant apps
- Use lean queries for API responses
- Implement proper indexing strategy
- Use aggregation pipelines efficiently

### 3. Caching Strategy
- Cache frequently accessed data
- Implement proper cache invalidation
- Use appropriate TTL values
- Monitor cache hit rates

### 4. Security
- Validate all user inputs
- Implement rate limiting
- Use HTTPS everywhere
- Sanitize outputs

### 5. Monitoring
- Track key performance metrics
- Set up alerting for anomalies
- Monitor error rates and patterns
- Regular performance audits

## Troubleshooting

### Common Performance Issues

#### Slow Database Queries
```javascript
// Enable query logging
mongoose.set('debug', true);

// Use explain() to analyze queries
const explanation = await Model.find(query).explain();
console.log('Query plan:', explanation);
```

#### Memory Leaks
```javascript
// Monitor memory growth
const memUsage = process.memoryUsage();
console.log('Memory usage:', memUsage);

// Check for event listener leaks
process.on('warning', (warning) => {
    if (warning.name === 'MaxListenersExceededWarning') {
        console.error('Potential memory leak detected');
    }
});
```

#### High CPU Usage
```javascript
// Profile CPU usage
const profiler = require('v8-profiler-next');
const title = 'cpu-profile';
const profile = profiler.startProfiling(title, true);

// After some time
const profileData = profiler.stopProfiling(title);
profileData.export((error, result) => {
    if (error) console.error(error);
    else fs.writeFileSync(`profile-${Date.now()}.cpuprofile`, result);
});
```

## Conclusion

This performance optimization framework provides a solid foundation for scaling to 100+ million users. Regular monitoring, testing, and optimization are essential for maintaining high performance as the application grows.

Key takeaways:
1. **Database optimization** is critical for multi-tenant applications
2. **Caching** significantly reduces database load
3. **Security validation** prevents performance degradation from attacks
4. **Monitoring** enables proactive performance management
5. **Horizontal scaling** requires careful architecture planning
