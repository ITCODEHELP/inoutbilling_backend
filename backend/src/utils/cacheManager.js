const crypto = require('crypto');

/**
 * High-performance caching system for 100M+ users
 * Supports Redis fallback to in-memory caching
 */

class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            errors: 0
        };
        
        // Initialize Redis if available
        this.redisClient = global.redisClient || null;
        
        // Cleanup interval for memory cache
        if (!this.redisClient) {
            this.cleanupInterval = setInterval(() => {
                this.cleanupExpired();
            }, 60000); // Cleanup every minute
        }
    }

    /**
     * Generate cache key
     * @param {string} prefix - Cache key prefix
     * @param {Object} params - Parameters for cache key
     * @param {string} userId - User ID for multi-tenant isolation
     * @returns {string} Cache key
     */
    generateKey(prefix, params, userId = null) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key];
                return result;
            }, {});
        
        const paramString = JSON.stringify(sortedParams);
        const hash = crypto.createHash('md5').update(paramString).digest('hex');
        
        const key = `${prefix}:${userId ? `${userId}:` : ''}${hash}`;
        
        // Limit key length for Redis
        return key.length > 250 ? key.substring(0, 250) : key;
    }

    /**
     * Get value from cache
     * @param {string} key - Cache key
     * @returns {Promise<any>} Cached value or null
     */
    async get(key) {
        try {
            if (this.redisClient) {
                return await this.getFromRedis(key);
            } else {
                return this.getFromMemory(key);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache get error:', error.message);
            return null;
        }
    }

    /**
     * Set value in cache
     * @param {string} key - Cache key
     * @param {any} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {Promise<boolean>} Success status
     */
    async set(key, value, ttl = 300000) { // Default 5 minutes
        try {
            if (this.redisClient) {
                return await this.setInRedis(key, value, ttl);
            } else {
                return this.setInMemory(key, value, ttl);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache set error:', error.message);
            return false;
        }
    }

    /**
     * Delete value from cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        try {
            if (this.redisClient) {
                return await this.deleteFromRedis(key);
            } else {
                return this.deleteFromMemory(key);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache delete error:', error.message);
            return false;
        }
    }

    /**
     * Clear all cache entries matching pattern
     * @param {string} pattern - Pattern to match (supports wildcards)
     * @returns {Promise<number>} Number of deleted entries
     */
    async invalidatePattern(pattern) {
        try {
            if (this.redisClient) {
                return await this.invalidatePatternRedis(pattern);
            } else {
                return this.invalidatePatternMemory(pattern);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache invalidate pattern error:', error.message);
            return 0;
        }
    }

    /**
     * Get multiple values in parallel
     * @param {Array} keys - Array of cache keys
     * @returns {Promise<Object>} Object with key-value pairs
     */
    async mget(keys) {
        try {
            if (this.redisClient) {
                return await this.mgetRedis(keys);
            } else {
                return await this.mgetMemory(keys);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mget error:', error.message);
            return {};
        }
    }

    /**
     * Set multiple values in parallel
     * @param {Object} keyValuePairs - Object with key-value pairs
     * @param {number} ttl - Time to live in milliseconds (optional)
     * @returns {Promise<boolean>} Success status
     */
    async mset(keyValuePairs, ttl = 300000) {
        try {
            if (this.redisClient) {
                return await this.msetRedis(keyValuePairs, ttl);
            } else {
                return await this.msetMemory(keyValuePairs, ttl);
            }
        } catch (error) {
            this.stats.errors++;
            console.error('Cache mset error:', error.message);
            return false;
        }
    }

    // Redis implementation methods
    async getFromRedis(key) {
        const value = await this.redisClient.get(key);
        if (value) {
            this.stats.hits++;
            return JSON.parse(value);
        } else {
            this.stats.misses++;
            return null;
        }
    }

    async setInRedis(key, value, ttl) {
        const serialized = JSON.stringify(value);
        const ttlSeconds = Math.ceil(ttl / 1000);
        const result = await this.redisClient.setex(key, ttlSeconds, serialized);
        this.stats.sets++;
        return result === 'OK';
    }

    async deleteFromRedis(key) {
        const result = await this.redisClient.del(key);
        this.stats.deletes++;
        return result > 0;
    }

    async invalidatePatternRedis(pattern) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
            const result = await this.redisClient.del(...keys);
            this.stats.deletes += result;
            return result;
        }
        return 0;
    }

    async mgetRedis(keys) {
        const values = await this.redisClient.mget(...keys);
        const result = {};
        
        keys.forEach((key, index) => {
            const value = values[index];
            if (value) {
                try {
                    result[key] = JSON.parse(value);
                    this.stats.hits++;
                } catch (parseError) {
                    result[key] = null;
                    this.stats.errors++;
                }
            } else {
                result[key] = null;
                this.stats.misses++;
            }
        });
        
        return result;
    }

    async msetRedis(keyValuePairs, ttl) {
        const ttlSeconds = Math.ceil(ttl / 1000);
        const pipeline = this.redisClient.pipeline();
        
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            const serialized = JSON.stringify(value);
            pipeline.setex(key, ttlSeconds, serialized);
        });
        
        const results = await pipeline.exec();
        this.stats.sets += Object.keys(keyValuePairs).length;
        return results.every(result => result[1] === 'OK');
    }

    // Memory implementation methods
    getFromMemory(key) {
        const item = this.memoryCache.get(key);
        if (item && item.expiresAt > Date.now()) {
            this.stats.hits++;
            return item.value;
        } else if (item) {
            // Expired, remove it
            this.memoryCache.delete(key);
        }
        
        this.stats.misses++;
        return null;
    }

    setInMemory(key, value, ttl) {
        const item = {
            value,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        };
        
        this.memoryCache.set(key, item);
        this.stats.sets++;
        return true;
    }

    deleteFromMemory(key) {
        const deleted = this.memoryCache.delete(key);
        if (deleted) {
            this.stats.deletes++;
        }
        return deleted;
    }

    invalidatePatternMemory(pattern) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        let deletedCount = 0;
        
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
                deletedCount++;
            }
        }
        
        this.stats.deletes += deletedCount;
        return deletedCount;
    }

    async mgetMemory(keys) {
        const result = {};
        
        keys.forEach(key => {
            const value = this.getFromMemory(key);
            result[key] = value;
        });
        
        return result;
    }

    async msetMemory(keyValuePairs, ttl) {
        Object.entries(keyValuePairs).forEach(([key, value]) => {
            this.setInMemory(key, value, ttl);
        });
        return true;
    }

    /**
     * Cleanup expired entries from memory cache
     */
    cleanupExpired() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, item] of this.memoryCache.entries()) {
            if (item.expiresAt <= now) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        // Silent cleanup
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
            : 0;
        
        return {
            ...this.stats,
            hitRate: Math.round(hitRate * 100) / 100,
            memorySize: this.memoryCache.size,
            uptime: process.uptime()
        };
    }

    /**
     * Clear all cache entries
     * @returns {Promise<boolean>} Success status
     */
    async clear() {
        try {
            if (this.redisClient) {
                await this.redisClient.flushdb();
            } else {
                this.memoryCache.clear();
            }
            
            // Reset stats
            this.stats = {
                hits: 0,
                misses: 0,
                sets: 0,
                deletes: 0,
                errors: 0
            };
            
            return true;
        } catch (error) {
            this.stats.errors++;
            console.error('Cache clear error:', error.message);
            return false;
        }
    }

    /**
     * Warm up cache with common data
     * @param {Object} warmupData - Data to warm up cache with
     * @returns {Promise<void>}
     */
    async warmup(warmupData) {
        const promises = Object.entries(warmupData).map(async ([key, data]) => {
            const { value, ttl } = data;
            await this.set(key, value, ttl);
        });
        
        await Promise.all(promises);
    }

    /**
     * Destroy cache manager and cleanup resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.memoryCache.clear();
    }
}

// Singleton instance
let cacheManagerInstance = null;

/**
 * Get cache manager instance (singleton pattern)
 * @returns {CacheManager} Cache manager instance
 */
function getCacheManager() {
    if (!cacheManagerInstance) {
        cacheManagerInstance = new CacheManager();
        
        // Make it globally available
        global.cacheManager = cacheManagerInstance;
    }
    
    return cacheManagerInstance;
}

module.exports = {
    CacheManager,
    getCacheManager
};
