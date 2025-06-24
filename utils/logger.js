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
    defaultMeta: { service: 'ImageUploadService' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', handleExceptions: true }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
    ],
    exitOnError: false
})

process.on('exit', () => logger.info('Process exiting...'))

module.exports = logger