const winston = require("winston");
const path = require("path");
const fs = require("fs");
const { envConfig } = require("../config/envConfig");

//Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir)
}

//Define custom log levels and colours
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4
}

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white'
}

winston.addColors(colors)

// Formatters
const logFormat = winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
)

const consoleFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`
        if (Object.keys(meta).length > 0) {
            msg += `\n${JSON.stringify(meta, null, 2)}`
        }
        return msg
    })
)

// Transport Definitions
const transports = [
    new winston.transports.File({
        filename: path.join(logsDir, 'app.log'),
        level: 'debug',
        format: logFormat,
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 5,
    }),
    new winston.transports.File({
        filename: path.join(logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5,
    }),
    new winston.transports.File({
        filename: path.join(logsDir, 'uploads.log'),
        level: 'info',
        format: logFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
    }),
]

// Console logging
transports.push(
    new winston.transports.Console({
        level: envConfig.NODE_ENV === 'development' ? 'debug' : 'info',
        format: envConfig.NODE_ENV === 'development' ? consoleFormat : logFormat,
    })
)

// Logger creation
const logger = winston.createLogger({
    level: envConfig.LOG_LEVEL || (envConfig.NODE_ENV === 'production' ? 'info' : 'debug'),
    levels,
    format: logFormat,
    defaultMeta: { service: 'ImageUploadService' },
    transports,
    exitOnError: false,
})

// Custom Logging Methods
logger.logUpload = (data) => {
    logger.info('File Upload', {
        type: 'UPLOAD',
        ...data,
        timestamp: new Date().toISOString(),
    })
}

logger.logProcessing = (data) => {
    logger.info('Image Processing', {
        type: 'PROCESSING',
        ...data,
        timestamp: new Date().toISOString(),
    })
}

logger.logError = (error, context = {}) => {
    const message = error instanceof Error ? error.message : error
    const stack = error instanceof Error ? error.stack : null
    logger.error('Application Error', {
        type: 'ERROR',
        message,
        stack,
        ...context,
    })
}

logger.logSecurity = (event, data = {}) => {
    logger.warn('Security Event', {
        type: 'SECURITY',
        event,
        ...data,
        timestamp: new Date().toISOString(),
    })
}

logger.logPerformance = (operation, duration, metadata = {}) => {
    logger.info('Performance Metric', {
        type: 'PERFORMANCE',
        operation,
        duration: `${duration}ms`,
        ...metadata,
        timestamp: new Date().toISOString(),
    })
}

logger.logAuth = (event, data = {}) => {
    logger.info('Authentication Event', {
        type: 'AUTH',
        event,
        ...data,
        timestamp: new Date().toISOString(),
    })
}

// Handle Uncaught Exceptions and Unhandled Rejections
logger.exceptions.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'exceptions.log'),
        format: logFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
    })
)

logger.rejections.handle(
    new winston.transports.File({
        filename: path.join(logsDir, 'rejections.log'),
        format: logFormat,
        maxsize: 5 * 1024 * 1024,
        maxFiles: 3,
    })
)

// Graceful shutdown log
process.on('exit', () => logger.info('Process exiting...'))

module.exports = logger