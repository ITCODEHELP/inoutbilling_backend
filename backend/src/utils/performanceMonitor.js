const EventEmitter = require('events');

/**
 * Performance monitoring system for 100M+ user scale
 * Tracks API performance, database queries, and system metrics
 */

class PerformanceMonitor extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                error: 0,
                avgResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0
            },
            database: {
                queries: 0,
                avgQueryTime: 0,
                slowQueries: 0,
                connections: 0
            },
            cache: {
                hits: 0,
                misses: 0,
                hitRate: 0
            },
            memory: {
                used: 0,
                total: 0,
                percentage: 0
            },
            cpu: {
                usage: 0,
                loadAverage: []
            }
        };
        
        this.responseTimes = [];
        this.queryTimes = [];
        this.slowQueryThreshold = 1000; // 1 second
        this.maxResponseTimeSamples = 10000;
        
        // Start monitoring intervals
        this.startMonitoring();
    }

    /**
     * Start performance monitoring intervals
     */
    startMonitoring() {
        // Collect system metrics every 30 seconds
        this.systemMetricsInterval = setInterval(() => {
            this.collectSystemMetrics();
        }, 30000);

        // Calculate percentiles every minute
        this.percentileInterval = setInterval(() => {
            this.calculatePercentiles();
        }, 60000);

        // Cleanup old data every 5 minutes
        this.cleanupInterval = setInterval(() => {
            this.cleanupOldData();
        }, 300000);
    }

    /**
     * Track API request performance
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {number} responseTime - Response time in milliseconds
     */
    trackRequest(req, res, responseTime) {
        this.metrics.requests.total++;
        
        if (res.statusCode >= 200 && res.statusCode < 400) {
            this.metrics.requests.success++;
        } else {
            this.metrics.requests.error++;
        }

        // Store response time for percentile calculation
        this.responseTimes.push({
            time: responseTime,
            method: req.method,
            route: req.route?.path || req.path,
            statusCode: res.statusCode,
            timestamp: Date.now()
        });

        // Keep only recent samples
        if (this.responseTimes.length > this.maxResponseTimeSamples) {
            this.responseTimes = this.responseTimes.slice(-this.maxResponseTimeSamples);
        }

        // Update average response time
        this.updateAverageResponseTime();

        // Emit event for real-time monitoring
        this.emit('request', {
            method: req.method,
            route: req.route?.path || req.path,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });

        // Alert on slow responses
        if (responseTime > 5000) { // 5 seconds
            this.emit('slow-request', {
                method: req.method,
                route: req.route?.path || req.path,
                responseTime
            });
        }
    }

    /**
     * Track database query performance
     * @param {string} operation - Database operation type
     * @param {string} collection - Collection name
     * @param {number} queryTime - Query time in milliseconds
     * @param {Object} query - Query details (sanitized)
     */
    trackQuery(operation, collection, queryTime, query = {}) {
        this.metrics.database.queries++;
        
        // Store query time for analysis
        this.queryTimes.push({
            operation,
            collection,
            time: queryTime,
            timestamp: Date.now()
        });

        // Track slow queries
        if (queryTime > this.slowQueryThreshold) {
            this.metrics.database.slowQueries++;
            this.emit('slow-query', {
                operation,
                collection,
                queryTime,
                query: this.sanitizeQuery(query)
            });
        }

        // Update average query time
        this.updateAverageQueryTime();
    }

    /**
     * Track cache performance
     * @param {string} operation - Cache operation (hit/miss/set/delete)
     * @param {string} key - Cache key (sanitized)
     */
    trackCache(operation, key) {
        if (operation === 'hit') {
            this.metrics.cache.hits++;
        } else if (operation === 'miss') {
            this.metrics.cache.misses++;
        }

        // Update hit rate
        const total = this.metrics.cache.hits + this.metrics.cache.misses;
        this.metrics.cache.hitRate = total > 0 ? (this.metrics.cache.hits / total) * 100 : 0;
    }

    /**
     * Collect system metrics
     */
    collectSystemMetrics() {
        const memUsage = process.memoryUsage();
        
        this.metrics.memory = {
            used: memUsage.heapUsed,
            total: memUsage.heapTotal,
            percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
            rss: memUsage.rss,
            external: memUsage.external
        };

        // CPU usage (simplified)
        this.metrics.cpu.usage = process.cpuUsage().user / 1000000; // Convert to seconds

        // Load average (Unix-like systems only)
        if (process.platform !== 'win32') {
            const loadAvg = require('os').loadavg();
            this.metrics.cpu.loadAverage = loadAvg;
        }

        // Emit system metrics event
        this.emit('system-metrics', this.metrics);
    }

    /**
     * Calculate response time percentiles
     */
    calculatePercentiles() {
        if (this.responseTimes.length === 0) return;

        const times = this.responseTimes.map(rt => rt.time).sort((a, b) => a - b);
        const len = times.length;

        this.metrics.requests.p95ResponseTime = times[Math.floor(len * 0.95)] || 0;
        this.metrics.requests.p99ResponseTime = times[Math.floor(len * 0.99)] || 0;
    }

    /**
     * Update average response time
     */
    updateAverageResponseTime() {
        if (this.responseTimes.length === 0) return;

        const total = this.responseTimes.reduce((sum, rt) => sum + rt.time, 0);
        this.metrics.requests.avgResponseTime = total / this.responseTimes.length;
    }

    /**
     * Update average query time
     */
    updateAverageQueryTime() {
        if (this.queryTimes.length === 0) return;

        const total = this.queryTimes.reduce((sum, qt) => sum + qt.time, 0);
        this.metrics.database.avgQueryTime = total / this.queryTimes.length;
    }

    /**
     * Clean up old data to prevent memory leaks
     */
    cleanupOldData() {
        const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

        // Clean old response times
        const originalResponseLength = this.responseTimes.length;
        this.responseTimes = this.responseTimes.filter(rt => rt.timestamp > cutoffTime);
        
        // Clean old query times
        const originalQueryLength = this.queryTimes.length;
        this.queryTimes = this.queryTimes.filter(qt => qt.timestamp > cutoffTime);

        // Silent cleanup
    }

    /**
     * Sanitize query for logging (remove sensitive data)
     * @param {Object} query - Query object
     * @returns {Object} Sanitized query
     */
    sanitizeQuery(query) {
        const sanitized = { ...query };
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });

        // Limit object size
        const queryStr = JSON.stringify(sanitized);
        if (queryStr.length > 1000) {
            return { query: '[LARGE QUERY]' };
        }

        return sanitized;
    }

    /**
     * Get current metrics
     * @returns {Object} Current performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: process.uptime(),
            timestamp: Date.now()
        };
    }

    /**
     * Get detailed performance report
     * @returns {Object} Detailed performance report
     */
    getDetailedReport() {
        const report = this.getMetrics();
        
        // Add route-specific metrics
        const routeMetrics = {};
        this.responseTimes.forEach(rt => {
            const route = `${rt.method} ${rt.route}`;
            if (!routeMetrics[route]) {
                routeMetrics[route] = {
                    count: 0,
                    avgTime: 0,
                    totalTime: 0,
                    errors: 0
                };
            }
            
            routeMetrics[route].count++;
            routeMetrics[route].totalTime += rt.time;
            routeMetrics[route].avgTime = routeMetrics[route].totalTime / routeMetrics[route].count;
            
            if (rt.statusCode >= 400) {
                routeMetrics[route].errors++;
            }
        });

        // Add database-specific metrics
        const dbMetrics = {};
        this.queryTimes.forEach(qt => {
            const key = `${qt.operation} ${qt.collection}`;
            if (!dbMetrics[key]) {
                dbMetrics[key] = {
                    count: 0,
                    avgTime: 0,
                    totalTime: 0,
                    slowQueries: 0
                };
            }
            
            dbMetrics[key].count++;
            dbMetrics[key].totalTime += qt.time;
            dbMetrics[key].avgTime = dbMetrics[key].totalTime / dbMetrics[key].count;
            
            if (qt.time > this.slowQueryThreshold) {
                dbMetrics[key].slowQueries++;
            }
        });

        return {
            ...report,
            routes: routeMetrics,
            database: {
                ...report.database,
                details: dbMetrics
            }
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.metrics = {
            requests: {
                total: 0,
                success: 0,
                error: 0,
                avgResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0
            },
            database: {
                queries: 0,
                avgQueryTime: 0,
                slowQueries: 0,
                connections: 0
            },
            cache: {
                hits: 0,
                misses: 0,
                hitRate: 0
            },
            memory: {
                used: 0,
                total: 0,
                percentage: 0
            },
            cpu: {
                usage: 0,
                loadAverage: []
            }
        };
        
        this.responseTimes = [];
        this.queryTimes = [];
        
        this.emit('metrics-reset');
    }

    /**
     * Stop monitoring and cleanup
     */
    stop() {
        if (this.systemMetricsInterval) {
            clearInterval(this.systemMetricsInterval);
        }
        if (this.percentileInterval) {
            clearInterval(this.percentileInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.removeAllListeners();
    }
}

// Singleton instance
let performanceMonitorInstance = null;

/**
 * Get performance monitor instance (singleton pattern)
 * @returns {PerformanceMonitor} Performance monitor instance
 */
function getPerformanceMonitor() {
    if (!performanceMonitorInstance) {
        performanceMonitorInstance = new PerformanceMonitor();
        
        // Make it globally available
        global.performanceMonitor = performanceMonitorInstance;
    }
    
    return performanceMonitorInstance;
}

/**
 * Express middleware for performance monitoring
 * @param {PerformanceMonitor} monitor - Performance monitor instance
 * @returns {Function} Express middleware
 */
function performanceMiddleware(monitor) {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Track response
        const originalSend = res.send;
        res.send = function(data) {
            const responseTime = Date.now() - startTime;
            monitor.trackRequest(req, res, responseTime);
            return originalSend.call(this, data);
        };
        
        next();
    };
}

module.exports = {
    PerformanceMonitor,
    getPerformanceMonitor,
    performanceMiddleware
};
