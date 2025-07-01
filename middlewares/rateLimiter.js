const rateLimit = require("express-rate-limit");
const { envConfig } = require("../config/envConfig");
const { ErrorCodeEnum } = require("../utils/errorCodeEnum");
const { HTTP_STATUS } = require("../config/httpConfig")
const logger = require("../utils/logger");

// Custom key generator that considers user ID if authenticated
const keyGenerator = (req) => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip
}

// Unified error response helper
const createRateLimitResponse = (res, key, message, errorCode, retryAfterSeconds) => {
    logger.warn(`${message} for key: ${key}`)
    res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        success: false,
        message,
        error: errorCode,
        retryAfter: retryAfterSeconds
    })
}

// Skip logic: allow admin, health, and docs
const skipRateLimit = (req) => {
    if (req.user?.role === 'ADMIN') return true
    if (req.path === '/health' || req.path.startsWith('/api-docs')) return true
    return false
}

// Shared options
const commonRateLimitOptions = {
    keyGenerator,
    skip: skipRateLimit,
    standardHeaders: true,
    legacyHeaders: false
}

// General API rate limiter
const generalRateLimit = rateLimit({
    ...commonRateLimitOptions,
    windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
    max: envConfig.RATE_LIMIT_MAX_REQUESTS,
    handler: (req, res) => createRateLimitResponse(
        res,
        keyGenerator(req),
        'Too many requests. Please try again later.',
        ErrorCodeEnum.RATE_LIMIT_EXCEEDED || 'RATE_LIMIT_EXCEEDED',
        Math.round(req.rateLimit.resetTime / 1000)
    )
})

// Upload limiter (more restrictive)
const uploadRateLimit = rateLimit({
    ...commonRateLimitOptions,
    windowMs: envConfig.RATE_LIMIT_WINDOW_MS,
    max: envConfig.LOCAL_UPLOAD_PATH || 10,
    handler: (req, res) =>
        createRateLimitResponse(
            res,
            keyGenerator(req),
            `Upload rate limit exceeded. Maximum ${envConfig.UPLOAD_RATE_LIMIT || 10} uploads per ${envConfig.RATE_LIMIT_WINDOW_MS / 60000} minutes.`,
            'UPLOAD_RATE_LIMIT_EXCEEDED',
            Math.round(req.rateLimit.resetTime / 1000)
        )
})

// Processing limiter
const processingRateLimit = rateLimit({
    ...commonRateLimitOptions,
    windowMs: 10 * 60 * 1000,
    max: 50,
    handler: (req, res) =>
        createRateLimitResponse(
            res,
            keyGenerator(req),
            'Processing rate limit exceeded. Please try again later',
            'PROCESSING_RATE_LIMIT_EXCEEDED',
            Math.round(req.rateLimit.resetTime / 1000)
        )
})

// Auth limiter (IP only)
const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
        createRateLimitResponse(
            res,
            req.ip,
            'Too many authentication attempts. Please try again later',
            'AUTH_RATE_LIMIT_EXCEEDED',
            Math.round(req.rateLimit.resetTime / 1000)
        )
})

// Strict limiter for sensitive operations
const strictRateLimit = rateLimit({
    ...commonRateLimitOptions,
    windowMs: 60 * 60 * 1000,
    max: 10,
    handler: (req, res) =>
        createRateLimitResponse(
            res,
            keyGenerator(req),
            'Rate limit exceeded for sensitive operations',
            'STRICT_RATE_LIMIT_EXCEEDED',
            Math.round(req.rateLimit.resetTime / 1000)
        )
})

// Dynamic limiter factory
const createDynamicRateLimit = (options = {}) => {
    return rateLimit({
        ...commonRateLimitOptions,
        windowMs: 15 * 60 * 1000,
        max: 100,
        handler: (req, res) =>
            createRateLimitResponse(
                res,
                keyGenerator(req),
                'Too many requests. Please try again later.',
                ErrorCodeEnum.RATE_LIMIT_EXCEEDED,
                Math.round(req.rateLimit.resetTime / 1000)
            ),
        ...options
    })
}

module.exports = {
    generalRateLimit,
    uploadRateLimit,
    processingRateLimit,
    authRateLimit,
    strictRateLimit,
    createDynamicRateLimit
}