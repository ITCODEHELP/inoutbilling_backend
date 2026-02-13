const jwt = require('jsonwebtoken');
const User = require('../models/User-Model/User');
const Staff = require('../models/Setting-Model/Staff');
const PerformanceOptimization = require('../utils/performanceOptimization');

// Rate limiting storage (in production, use Redis)
const rateLimitMap = new Map();

/**
 * Optimized authentication middleware for 100M+ users
 * Features: caching, rate limiting, lean queries, parallel execution
 */
const protect = async (req, res, next) => {
    let token;
    try {

        // 1. Get raw header (handles 'authorization', 'Authorization', etc.)
        const authHeader = req.header('Authorization');

        if (authHeader) {
            if (authHeader.toLowerCase().startsWith('bearer ')) {
                // Standard Bearer token
                token = authHeader.split(' ')[1];
            } else {
                // Fallback: Client sent raw token without 'Bearer ' prefix
                // Check if it looks like a JWT (3 parts separated by dots)
                if (authHeader.split('.').length === 3) {
                    token = authHeader;
                }
            }
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }

        // Rate limiting check (100 requests per minute per IP)
        const clientIP = req.ip || req.connection.remoteAddress;
        const rateLimitResult = PerformanceOptimization.checkRateLimit(
            rateLimitMap,
            clientIP,
            100, // 100 requests
            60000 // 1 minute
        );

        if (!rateLimitResult.allowed) {
            return res.status(429).json({
                message: 'Too many requests',
                retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
            });
        }

        // Build cache key for token verification
        const cacheKey = PerformanceOptimization.buildCacheKey('auth', { token }, 'global');

        // Try to get from cache first
        let userData;
        let isStaff = false; // Flag to track if authenticated user is a staff member

        if (global.cacheManager) {
            userData = await global.cacheManager.get(cacheKey);
        }

        if (!userData) {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // 1. Try to find User (Owner) first
            const userQuery = User.findById(decoded.id).select('-password').lean();
            let user = await userQuery;

            if (user) {
                userData = user;
                isStaff = false;
            } else {
                // 2. If not User, try to find Staff
                const staffQuery = Staff.findById(decoded.id).select('-password').lean();
                const staff = await staffQuery;

                if (staff) {
                    userData = staff;
                    isStaff = true;
                }
            }

            if (!userData) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }

            // Cache the user data for 5 minutes
            // We store isStaff in cache key or adjacent, but here simpler to just cache object
            // If we need to persist isStaff, we might need a wrapper object in cache, 
            // but for now let's assume userData properties distinguish (Staff has ownerRef).
            // Actually, best to just re-fetch or rely on structure. 
            // For now, simple caching.
            if (global.cacheManager) {
                // Add isStaff to saved data for retrieval
                userData._isStaff = isStaff;
                await global.cacheManager.set(cacheKey, userData, 300000); // 5 minutes
            }
        } else {
            // Recover isStaff flag from cached object
            isStaff = userData._isStaff === true;
        }

        // --- ACCOUNT STATUS CHECK ---
        // Block request if account is disabled/inactive
        if (userData.isActive === false || userData.isEnabled === false) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been disabled, please contact the owner'
            });
        }

        // Attach user to request (minimal data for performance)
        req.user = {
            ...userData, // Attach full user/staff object (lean)
            isStaff: isStaff // Explicit flag for controllers to use
        };

        // Add rate limit headers
        res.set({
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
        });

        return next();
    } catch (error) {
        // console.error('Auth middleware error:', error.message);

        // Clear cache on error
        if (global.cacheManager && token) {
            const cacheKey = PerformanceOptimization.buildCacheKey('auth', { token }, 'global');
            await global.cacheManager.delete(cacheKey);
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Not authorized, invalid token' });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Not authorized, token expired' });
        }

        return res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        const authHeader = req.header('Authorization');

        if (authHeader) {
            if (authHeader.toLowerCase().startsWith('bearer ')) {
                token = authHeader.split(' ')[1];
            } else if (authHeader.split('.').length === 3) {
                token = authHeader;
            }
        }

        if (!token) {
            return next(); // Continue without user
        }

        // Try to authenticate but don't fail if it fails
        const cacheKey = PerformanceOptimization.buildCacheKey('auth', { token }, 'global');
        let userData;

        if (global.cacheManager) {
            userData = await global.cacheManager.get(cacheKey);
        }

        if (!userData) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id).select('-password').lean();

                if (user) {
                    userData = user;
                    if (global.cacheManager) {
                        await global.cacheManager.set(cacheKey, userData, 300000);
                    }
                }
            } catch (authError) {
                // Ignore auth errors for optional auth
                return next();
            }
        }

        if (userData) {
            req.user = {
                _id: userData._id,
                userId: userData.userId,
                phone: userData.phone,
                countryCode: userData.countryCode,
                isVerified: userData.isVerified
            };
        }

        return next();
    } catch (error) {
        // For optional auth, always continue
        return next();
    }
};

/**
 * Role-based authorization middleware
 * @param {Array} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        // Check if user has required role (implement role system as needed)
        const userRole = req.user.role || 'user';

        if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
            return res.status(403).json({ message: 'Not authorized, insufficient permissions' });
        }

        return next();
    };
};

/**
 * Admin-only middleware
 */
const adminOnly = authorize('admin', 'superadmin');

/**
 * Self-or-admin middleware (user can access their own data or admin can access any)
 */
const selfOrAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    const userRole = req.user.role || 'user';
    const targetUserId = req.params.userId || req.params.id;

    // Allow access if user is admin or accessing their own data
    if (userRole === 'admin' || userRole === 'superadmin' || req.user._id.toString() === targetUserId) {
        return next();
    }

    return res.status(403).json({ message: 'Not authorized, insufficient permissions' });
};

module.exports = {
    protect,
    optionalAuth,
    authorize,
    adminOnly,
    selfOrAdmin
};
