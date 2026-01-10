const mongoose = require('mongoose');

/**
 * Performance optimization utilities for 100M+ user scale
 * Provides indexing strategies, query optimization, and caching helpers
 */

class PerformanceOptimization {
    /**
     * Create optimized indexes for multi-tenant scale
     * @param {mongoose.Model} model - Mongoose model
     * @param {Array} indexDefinitions - Index definitions
     */
    static async createOptimizedIndexes(model, indexDefinitions) {
        try {
            // Drop existing indexes to avoid conflicts
            await model.collection.dropIndexes().catch(() => {});
            
            // Create new indexes in parallel for performance
            const indexPromises = indexDefinitions.map(indexDef => {
                return model.collection.createIndex(indexDef.fields, indexDef.options);
            });
            
            await Promise.all(indexPromises);
        } catch (error) {
            // Silent index creation
        }
    }

    /**
     * Build lean query with projection for performance
     * @param {mongoose.Query} query - Mongoose query
     * @param {Array} fields - Fields to include
     * @returns {mongoose.Query} Optimized query
     */
    static buildLeanQuery(query, fields = []) {
        // Use lean() for better performance with large datasets
        let optimizedQuery = query.lean();
        
        // Add projection if fields specified
        if (fields && fields.length > 0) {
            const projection = fields.reduce((proj, field) => {
                proj[field] = 1;
                return proj;
            }, { _id: 0 });
            
            optimizedQuery = optimizedQuery.select(projection);
        }
        
        return optimizedQuery;
    }

    /**
     * Build optimized aggregation pipeline
     * @param {Array} pipeline - MongoDB aggregation pipeline
     * @param {Object} options - Optimization options
     * @returns {Array} Optimized pipeline
     */
    static buildOptimizedPipeline(pipeline, options = {}) {
        const optimizedPipeline = [...pipeline];
        
        // Add allowDiskUse for large datasets
        if (options.allowDiskUse !== false) {
            optimizedPipeline.push({ $allowDiskUse: true });
        }
        
        // Optimize $match stages - move userId filter to beginning
        const userIdMatchIndex = optimizedPipeline.findIndex(stage => 
            stage.$match && stage.$match.userId
        );
        
        if (userIdMatchIndex > 0) {
            const userIdMatch = optimizedPipeline.splice(userIdMatchIndex, 1)[0];
            optimizedPipeline.unshift(userIdMatch);
        }
        
        return optimizedPipeline;
    }

    /**
     * Execute parallel queries for better performance
     * @param {Array} queries - Array of query functions
     * @returns {Promise<Array>} Results array
     */
    static async executeParallelQueries(queries) {
        try {
            const results = await Promise.allSettled(queries.map(query => query()));
            
            return results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return { success: true, data: result.value };
                } else {
                    console.error(`Query ${index} failed:`, result.reason);
                    return { success: false, error: result.reason.message };
                }
            });
        } catch (error) {
            console.error('Parallel query execution failed:', error);
            throw error;
        }
    }

    /**
     * Create pagination cursor for large datasets
     * @param {Object} lastDoc - Last document from previous page
     * @param {string} sortField - Field used for sorting
     * @param {number} limit - Page size
     * @returns {Object} Pagination cursor
     */
    static createPaginationCursor(lastDoc, sortField, limit) {
        if (!lastDoc) {
            return { limit };
        }
        
        const cursor = {
            limit,
            _id: lastDoc._id
        };
        
        if (sortField && lastDoc[sortField]) {
            cursor[sortField] = lastDoc[sortField];
        }
        
        return cursor;
    }

    /**
     * Build cursor-based pagination query
     * @param {mongoose.Query} query - Mongoose query
     * @param {Object} cursor - Pagination cursor
     * @param {string} sortField - Sort field
     * @param {string} sortOrder - Sort order ('asc' or 'desc')
     * @returns {mongoose.Query} Paginated query
     */
    static buildCursorPagination(query, cursor, sortField, sortOrder = 'asc') {
        let paginatedQuery = query;
        
        if (cursor && cursor._id) {
            const sortOperator = sortOrder === 'asc' ? '$gt' : '$lt';
            const matchCondition = { _id: { [sortOperator]: cursor._id } };
            
            if (sortField && cursor[sortField]) {
                const fieldOperator = sortOrder === 'asc' ? '$gte' : '$lte';
                matchCondition[sortField] = { [fieldOperator]: cursor[sortField] };
            }
            
            paginatedQuery = query.where(matchCondition);
        }
        
        // Add sorting
        const sort = {};
        sort[sortField] = sortOrder === 'asc' ? 1 : -1;
        sort._id = sortOrder === 'asc' ? 1 : -1;
        
        paginatedQuery = paginatedQuery.sort(sort);
        
        // Add limit
        if (cursor && cursor.limit) {
            paginatedQuery = paginatedQuery.limit(cursor.limit);
        }
        
        return paginatedQuery;
    }

    /**
     * Validate and sanitize input for security
     * @param {any} input - Input to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} Validated and sanitized input
     */
    static validateAndSanitizeInput(input, schema) {
        const errors = [];
        const sanitized = {};
        
        for (const [field, rules] of Object.entries(schema)) {
            const value = input[field];
            
            // Check if required
            if (rules.required && (value === undefined || value === null || value === '')) {
                errors.push(`${field} is required`);
                continue;
            }
            
            // Skip validation if field is not provided and not required
            if (value === undefined && !rules.required) {
                continue;
            }
            
            // Type validation
            if (rules.type && typeof value !== rules.type) {
                errors.push(`${field} must be of type ${rules.type}`);
                continue;
            }
            
            // String validation
            if (rules.type === 'string') {
                if (rules.minLength && value.length < rules.minLength) {
                    errors.push(`${field} must be at least ${rules.minLength} characters`);
                }
                if (rules.maxLength && value.length > rules.maxLength) {
                    errors.push(`${field} must not exceed ${rules.maxLength} characters`);
                }
                if (rules.pattern && !rules.pattern.test(value)) {
                    errors.push(`${field} format is invalid`);
                }
            }
            
            // Number validation
            if (rules.type === 'number') {
                if (rules.min !== undefined && value < rules.min) {
                    errors.push(`${field} must be at least ${rules.min}`);
                }
                if (rules.max !== undefined && value > rules.max) {
                    errors.push(`${field} must not exceed ${rules.max}`);
                }
            }
            
            // Array validation
            if (rules.type === 'array') {
                if (!Array.isArray(value)) {
                    errors.push(`${field} must be an array`);
                } else if (rules.maxItems && value.length > rules.maxItems) {
                    errors.push(`${field} must not exceed ${rules.maxItems} items`);
                }
            }
            
            // Sanitize value
            if (rules.sanitize && typeof value === 'string') {
                sanitized[field] = value.trim();
            } else {
                sanitized[field] = value;
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            data: sanitized
        };
    }

    /**
     * Build cache key for query results
     * @param {string} prefix - Cache key prefix
     * @param {Object} params - Query parameters
     * @param {string} userId - User ID for multi-tenant isolation
     * @returns {string} Cache key
     */
    static buildCacheKey(prefix, params, userId) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key];
                return result;
            }, {});
        
        const paramString = JSON.stringify(sortedParams);
        const hash = require('crypto')
            .createHash('md5')
            .update(paramString)
            .digest('hex');
        
        return `${prefix}:${userId}:${hash}`;
    }

    /**
     * Rate limiting helper
     * @param {Map} rateLimitMap - Rate limit storage
     * @param {string} key - Rate limit key (usually user ID)
     * @param {number} limit - Request limit
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Object} Rate limit result
     */
    static checkRateLimit(rateLimitMap, key, limit, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Get existing requests for this key
        let requests = rateLimitMap.get(key) || [];
        
        // Remove old requests outside the window
        requests = requests.filter(timestamp => timestamp > windowStart);
        
        // Check if limit exceeded
        if (requests.length >= limit) {
            return {
                allowed: false,
                remaining: 0,
                resetTime: requests[0] + windowMs
            };
        }
        
        // Add current request
        requests.push(now);
        rateLimitMap.set(key, requests);
        
        return {
            allowed: true,
            remaining: limit - requests.length,
            resetTime: now + windowMs
        };
    }
}

module.exports = PerformanceOptimization;
