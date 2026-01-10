const crypto = require('crypto');
const PerformanceOptimization = require('./performanceOptimization');

/**
 * Comprehensive security validation and sanitization utilities
 * Designed for 100M+ user scale with performance optimization
 */

class SecurityValidation {
    /**
     * XSS protection - sanitize HTML content
     * @param {string} input - Input string to sanitize
     * @returns {string} Sanitized string
     */
    static sanitizeHTML(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * SQL/NoSQL injection protection
     * @param {string} input - Input string to validate
     * @returns {boolean} True if safe, false if potentially malicious
     */
    static isSafeFromInjection(input) {
        if (typeof input !== 'string') return true;
        
        const maliciousPatterns = [
            /\$where/i,
            /\$ne/i,
            /\$gt/i,
            /\$lt/i,
            /\$gte/i,
            /\$lte/i,
            /\$in/i,
            /\$nin/i,
            /\$regex/i,
            /\$expr/i,
            /javascript:/i,
            /<script/i,
            /on\w+\s*=/i,
            /union\s+select/i,
            /drop\s+table/i,
            /delete\s+from/i,
            /insert\s+into/i,
            /update\s+set/i
        ];

        return !maliciousPatterns.some(pattern => pattern.test(input));
    }

    /**
     * Validate and sanitize user input with comprehensive schema
     * @param {any} input - Input to validate
     * @param {Object} schema - Validation schema
     * @returns {Object} Validation result with sanitized data
     */
    static validateInput(input, schema) {
        const errors = [];
        const sanitized = {};
        const warnings = [];

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

            // Injection protection
            if (typeof value === 'string' && !this.isSafeFromInjection(value)) {
                errors.push(`${field} contains potentially malicious content`);
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
                if (rules.noHTML) {
                    sanitized[field] = this.sanitizeHTML(value);
                } else if (rules.trim) {
                    sanitized[field] = value.trim();
                } else {
                    sanitized[field] = value;
                }
            }

            // Number validation
            else if (rules.type === 'number') {
                const numValue = Number(value);
                if (isNaN(numValue)) {
                    errors.push(`${field} must be a valid number`);
                } else {
                    if (rules.min !== undefined && numValue < rules.min) {
                        errors.push(`${field} must be at least ${rules.min}`);
                    }
                    if (rules.max !== undefined && numValue > rules.max) {
                        errors.push(`${field} must not exceed ${rules.max}`);
                    }
                    if (rules.positive && numValue <= 0) {
                        errors.push(`${field} must be positive`);
                    }
                    sanitized[field] = numValue;
                }
            }

            // Array validation
            else if (rules.type === 'array') {
                if (!Array.isArray(value)) {
                    errors.push(`${field} must be an array`);
                } else {
                    if (rules.maxItems && value.length > rules.maxItems) {
                        errors.push(`${field} must not exceed ${rules.maxItems} items`);
                    }
                    if (rules.minItems && value.length < rules.minItems) {
                        errors.push(`${field} must have at least ${rules.minItems} items`);
                    }
                    if (rules.itemType) {
                        const invalidItems = value.filter(item => typeof item !== rules.itemType);
                        if (invalidItems.length > 0) {
                            errors.push(`${field} contains invalid item types`);
                        }
                    }
                    sanitized[field] = value;
                }
            }

            // Object validation
            else if (rules.type === 'object') {
                if (typeof value !== 'object' || Array.isArray(value)) {
                    errors.push(`${field} must be an object`);
                } else {
                    sanitized[field] = value;
                }
            }

            // Boolean validation
            else if (rules.type === 'boolean') {
                if (typeof value !== 'boolean') {
                    errors.push(`${field} must be a boolean`);
                } else {
                    sanitized[field] = value;
                }
            }

            // Date validation
            else if (rules.type === 'date') {
                const dateValue = new Date(value);
                if (isNaN(dateValue.getTime())) {
                    errors.push(`${field} must be a valid date`);
                } else {
                    sanitized[field] = dateValue;
                }
            }

            // Email validation
            else if (rules.type === 'email') {
                const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailPattern.test(value)) {
                    errors.push(`${field} must be a valid email address`);
                } else {
                    sanitized[field] = value.toLowerCase().trim();
                }
            }

            // Phone validation
            else if (rules.type === 'phone') {
                const phonePattern = /^\+?[\d\s\-\(\)]+$/;
                if (!phonePattern.test(value)) {
                    errors.push(`${field} must be a valid phone number`);
                } else {
                    sanitized[field] = value.replace(/\s/g, '');
                }
            }

            // ObjectId validation
            else if (rules.type === 'objectId') {
                const objectIdPattern = /^[0-9a-fA-F]{24}$/;
                if (!objectIdPattern.test(value)) {
                    errors.push(`${field} must be a valid ObjectId`);
                } else {
                    sanitized[field] = value;
                }
            }

            else {
                sanitized[field] = value;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            data: sanitized
        };
    }

    /**
     * Generate secure random token
     * @param {number} length - Token length
     * @returns {string} Secure random token
     */
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    /**
     * Hash password with bcrypt (placeholder - implement actual bcrypt)
     * @param {string} password - Plain text password
     * @returns {string} Hashed password
     */
    static async hashPassword(password) {
        // In production, use bcrypt: await bcrypt.hash(password, 12)
        const hash = crypto.createHash('sha256');
        hash.update(password + process.env.PASSWORD_SALT || 'default-salt');
        return hash.digest('hex');
    }

    /**
     * Verify password against hash
     * @param {string} password - Plain text password
     * @param {string} hash - Hashed password
     * @returns {boolean} True if password matches
     */
    static async verifyPassword(password, hash) {
        const hashInput = crypto.createHash('sha256');
        hashInput.update(password + process.env.PASSWORD_SALT || 'default-salt');
        const hashedInput = hashInput.digest('hex');
        return hashedInput === hash;
    }

    /**
     * Rate limiting with Redis fallback
     * @param {string} key - Rate limit key
     * @param {number} limit - Request limit
     * @param {number} windowMs - Time window in milliseconds
     * @returns {Object} Rate limit result
     */
    static async checkRateLimit(key, limit, windowMs) {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Try Redis first (in production)
        if (global.redisClient) {
            try {
                const redisKey = `rate_limit:${key}`;
                
                // Remove old entries
                await global.redisClient.zremrangebyscore(redisKey, 0, windowStart);
                
                // Get current count
                const count = await global.redisClient.zcard(redisKey);
                
                if (count >= limit) {
                    const oldestRequest = await global.redisClient.zrange(redisKey, 0, 0, 'WITHSCORES');
                    return {
                        allowed: false,
                        remaining: 0,
                        resetTime: parseInt(oldestRequest[1]) + windowMs
                    };
                }
                
                // Add current request
                await global.redisClient.zadd(redisKey, now, now);
                await global.redisClient.expire(redisKey, Math.ceil(windowMs / 1000));
                
                return {
                    allowed: true,
                    remaining: limit - count - 1,
                    resetTime: now + windowMs
                };
            } catch (redisError) {
                console.warn('Redis rate limiting failed, falling back to memory:', redisError.message);
            }
        }
        
        // Fallback to memory-based rate limiting
        return PerformanceOptimization.checkRateLimit(
            global.rateLimitMap || new Map(),
            key,
            limit,
            windowMs
        );
    }

    /**
     * Validate file upload security
     * @param {Object} file - File object from multer
     * @param {Object} options - Validation options
     * @returns {Object} Validation result
     */
    static validateFileUpload(file, options = {}) {
        const errors = [];
        const allowedMimeTypes = options.allowedMimeTypes || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/plain',
            'application/json'
        ];
        const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB default

        if (!file) {
            errors.push('No file provided');
            return { isValid: false, errors };
        }

        // Check file size
        if (file.size > maxSize) {
            errors.push(`File size exceeds maximum allowed size of ${maxSize} bytes`);
        }

        // Check MIME type
        if (!allowedMimeTypes.includes(file.mimetype)) {
            errors.push(`File type ${file.mimetype} is not allowed`);
        }

        // Check file extension
        const allowedExtensions = options.allowedExtensions || ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt', '.json'];
        const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
        if (!allowedExtensions.includes(fileExtension)) {
            errors.push(`File extension ${fileExtension} is not allowed`);
        }

        // Scan for malicious content (basic check)
        if (file.buffer) {
            const content = file.buffer.toString('utf8', 0, 1024); // Check first 1KB
            if (content.includes('<script') || content.includes('javascript:')) {
                errors.push('File contains potentially malicious content');
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Common validation schemas for reuse
     */
    static schemas = {
        user: {
            phone: {
                type: 'string',
                required: true,
                pattern: /^\+?[\d\s\-\(\)]+$/,
                maxLength: 20,
                trim: true
            },
            email: {
                type: 'email',
                required: false,
                maxLength: 255
            },
            userId: {
                type: 'string',
                required: true,
                minLength: 3,
                maxLength: 50,
                pattern: /^[a-zA-Z0-9_-]+$/,
                trim: true
            },
            password: {
                type: 'string',
                required: false,
                minLength: 8,
                maxLength: 128
            },
            companyName: {
                type: 'string',
                required: false,
                maxLength: 255,
                noHTML: true,
                trim: true
            }
        },
        
        pagination: {
            page: {
                type: 'number',
                required: false,
                min: 1,
                max: 10000
            },
            limit: {
                type: 'number',
                required: false,
                min: 1,
                max: 1000
            }
        },
        
        dateRange: {
            from: {
                type: 'date',
                required: false
            },
            to: {
                type: 'date',
                required: false
            }
        },
        
        mongoQuery: {
            match: {
                type: 'object',
                required: false
            },
            sort: {
                type: 'object',
                required: false
            },
            limit: {
                type: 'number',
                required: false,
                min: 1,
                max: 1000
            },
            skip: {
                type: 'number',
                required: false,
                min: 0
            }
        }
    };
}

module.exports = SecurityValidation;
