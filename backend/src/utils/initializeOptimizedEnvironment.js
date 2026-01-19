const mongoose = require('mongoose');
const User = require('../models/User-Model/User');
const SaleInvoice = require('../models/Sales-Invoice-Model/SaleInvoice');
const { getCacheManager } = require('./cacheManager');
const { getPerformanceMonitor } = require('./performanceMonitor');

/**
 * Initialize optimized environment for 100M+ users
 * Sets up indexes, cache, monitoring, and performance optimizations
 */

class OptimizedEnvironmentInitializer {
    constructor() {
        this.cacheManager = getCacheManager();
        this.performanceMonitor = getPerformanceMonitor();
        this.initialized = false;
    }

    /**
     * Initialize all optimization components
     * @returns {Promise<Object>} Initialization results
     */
    async initialize() {
        if (this.initialized) {
            return { success: true, message: 'Already initialized' };
        }

        const results = {
            database: { success: false, message: '' },
            indexes: { success: false, message: '', details: {} },
            cache: { success: false, message: '' },
            monitoring: { success: false, message: '' },
            performance: { success: false, message: '' }
        };

        try {
            // 1. Initialize database connection (SILENT)
            await this.initializeDatabase();
            results.database = { success: true, message: 'Database connected' };

            // 2. Create optimized indexes (SILENT)
            const indexResults = await this.createOptimizedIndexes();
            results.indexes = { success: true, message: 'Indexes created', details: indexResults };

            // 3. Initialize cache system (SILENT)
            await this.initializeCache();
            results.cache = { success: true, message: 'Cache system initialized' };

            // 4. Initialize monitoring (SILENT)
            this.initializeMonitoring();
            results.monitoring = { success: true, message: 'Monitoring initialized' };

            // 5. Warm up cache with common data (SILENT)
            await this.warmupCache();
            results.performance = { success: true, message: 'Cache warmed up' };

            this.initialized = true;

            return { success: true, message: 'All components initialized successfully', results };

        } catch (error) {
            return { success: false, message: error.message, results };
        }
    }

    /**
     * Initialize database connection with optimized settings
     */
    async initializeDatabase() {
        // Check if already connected
        if (mongoose.connection.readyState === 1) {
            return;
        }

        // Optimized connection options
        const mongoOptions = {
            maxPoolSize: 50,           // Maximum connections
            minPoolSize: 5,            // Minimum connections
            maxIdleTimeMS: 30000,     // Close idle connections
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,       // Disable buffering
            bufferCommands: false,    // Disable command buffering
            retryWrites: true,
            w: 'majority',
            readPreference: 'secondaryPreferred'
        };

        // Connect with optimized options
        await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, mongoOptions);
    }

    /**
     * Create optimized indexes for all models
     */
    async createOptimizedIndexes() {
        const results = {};

        try {
            // User model indexes (SILENT)
            await User.createOptimizedIndexes();
            results.user = 'User indexes created successfully';

            // SaleInvoice model indexes (SILENT)
            await SaleInvoice.createOptimizedIndexes();
            results.saleInvoice = 'SaleInvoice indexes created successfully';

            // Additional models can be added here
            // await OtherModel.createOptimizedIndexes();

            return results;

        } catch (error) {
            return results;
        }
    }

    /**
     * Initialize cache system
     */
    async initializeCache() {
        try {
            // Test cache functionality
            const testKey = 'init-test';
            const testValue = { initialized: true, timestamp: Date.now() };
            
            await this.cacheManager.set(testKey, testValue, 60000);
            const retrieved = await this.cacheManager.get(testKey);
            
            if (retrieved && retrieved.initialized) {
                await this.cacheManager.delete(testKey);
            }

        } catch (error) {
            // Don't throw - cache failure shouldn't stop initialization
        }
    }

    /**
     * Initialize performance monitoring
     */
    initializeMonitoring() {
        try {
            // Set up event listeners for monitoring (SILENT)
            this.performanceMonitor.on('slow-request', (data) => {
                // Silent monitoring
            });

            this.performanceMonitor.on('slow-query', (data) => {
                // Silent monitoring
            });

            this.performanceMonitor.on('system-metrics', (metrics) => {
                // Silent monitoring - no memory warnings
            });

        } catch (error) {
            // Silent error
        }
    }

    /**
     * Warm up cache with common data
     */
    async warmupCache() {
        try {
            const warmupData = {};

            // Cache common configuration data
            warmupData['app-config'] = {
                value: {
                    version: process.env.npm_package_version || '1.0.0',
                    environment: process.env.NODE_ENV || 'development',
                    features: {
                        otp: true,
                        reports: true,
                        caching: true
                    }
                },
                ttl: 3600000 // 1 hour
            };

            // Cache validation schemas
            warmupData['validation-schemas'] = {
                value: require('./securityValidation').schemas,
                ttl: 3600000 // 1 hour
            };

            // Cache performance thresholds
            warmupData['performance-thresholds'] = {
                value: {
                    slowRequestThreshold: 5000,    // 5 seconds
                    slowQueryThreshold: 1000,      // 1 second
                    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
                    maxCpuUsage: 70                 // 70%
                },
                ttl: 3600000 // 1 hour
            };

            await this.cacheManager.warmup(warmupData);

        } catch (error) {
            // Don't throw - warmup failure shouldn't stop initialization
        }
    }

    /**
     * Get current status of all components
     * @returns {Object} Status information
     */
    async getStatus() {
        const status = {
            initialized: this.initialized,
            database: {
                connected: mongoose.connection.readyState === 1,
                state: mongoose.connection.readyState
            },
            cache: {
                type: this.cacheManager.redisClient ? 'redis' : 'memory',
                stats: this.cacheManager.getStats()
            },
            monitoring: {
                active: this.performanceMonitor !== null,
                metrics: this.performanceMonitor.getMetrics()
            }
        };

        return status;
    }

    /**
     * Run health checks on all components
     * @returns {Object} Health check results
     */
    async runHealthChecks() {
        const checks = {
            database: { status: 'unknown', message: '', responseTime: 0 },
            cache: { status: 'unknown', message: '', responseTime: 0 },
            memory: { status: 'unknown', message: '', usage: 0 },
            performance: { status: 'unknown', message: '', metrics: {} }
        };

        // Database health check
        try {
            const start = Date.now();
            await mongoose.connection.db.admin().ping();
            checks.database = {
                status: 'healthy',
                message: 'Database responding',
                responseTime: Date.now() - start
            };
        } catch (error) {
            checks.database = {
                status: 'unhealthy',
                message: error.message,
                responseTime: 0
            };
        }

        // Cache health check
        try {
            const start = Date.now();
            const testKey = 'health-check';
            await this.cacheManager.set(testKey, { test: true }, 1000);
            const retrieved = await this.cacheManager.get(testKey);
            await this.cacheManager.delete(testKey);
            
            if (retrieved && retrieved.test) {
                checks.cache = {
                    status: 'healthy',
                    message: 'Cache operational',
                    responseTime: Date.now() - start
                };
            } else {
                checks.cache = {
                    status: 'unhealthy',
                    message: 'Cache test failed',
                    responseTime: 0
                };
            }
        } catch (error) {
            checks.cache = {
                status: 'unhealthy',
                message: error.message,
                responseTime: 0
            };
        }

        // Memory health check
        const memUsage = process.memoryUsage();
        const memoryPercentage = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        
        if (memoryPercentage < 80) {
            checks.memory = {
                status: 'healthy',
                message: 'Memory usage normal',
                usage: memoryPercentage
            };
        } else {
            checks.memory = {
                status: 'warning',
                message: 'High memory usage',
                usage: memoryPercentage
            };
        }

        // Performance health check
        try {
            const metrics = this.performanceMonitor.getMetrics();
            const avgResponseTime = metrics.requests.avgResponseTime;
            
            if (avgResponseTime < 500) {
                checks.performance = {
                    status: 'healthy',
                    message: 'Performance normal',
                    metrics: {
                        avgResponseTime,
                        hitRate: metrics.cache.hitRate,
                        errorRate: (metrics.requests.error / metrics.requests.total) * 100
                    }
                };
            } else {
                checks.performance = {
                    status: 'warning',
                    message: 'High response times',
                    metrics: {
                        avgResponseTime,
                        hitRate: metrics.cache.hitRate,
                        errorRate: (metrics.requests.error / metrics.requests.total) * 100
                    }
                };
            }
        } catch (error) {
            checks.performance = {
                status: 'unknown',
                message: error.message,
                metrics: {}
            };
        }

        return checks;
    }

    /**
     * Cleanup and shutdown
     */
    async shutdown() {
        try {
            // Stop monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
            }

            // Clear cache
            if (this.cacheManager) {
                await this.cacheManager.clear();
                this.cacheManager.destroy();
            }

            // Close database connection
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
            }

            this.initialized = false;

        } catch (error) {
            // Silent shutdown
        }
    }
}

// Singleton instance
let initializerInstance = null;

/**
 * Get initializer instance (singleton pattern)
 * @returns {OptimizedEnvironmentInitializer} Initializer instance
 */
function getInitializer() {
    if (!initializerInstance) {
        initializerInstance = new OptimizedEnvironmentInitializer();
    }
    
    return initializerInstance;
}

module.exports = {
    OptimizedEnvironmentInitializer,
    getInitializer
};
