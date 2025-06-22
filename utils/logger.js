const winston = require("winston");
require("dotenv").config();

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json()
    ),
    defaultMeta: { service: 'Image Uploader' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: 'error.log', level: 'error', handleExceptions: true }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
    exitOnError: false
})

process.on('exit', () => {
    if (logger.end) {
        logger.end()
    }
})

module.exports = logger