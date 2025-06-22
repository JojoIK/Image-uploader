const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
require('dotenv').config();


// Initialize Prisma Client with logging
const prisma = new PrismaClient({
    log: [
        {
            emit: 'event',
            level: 'query'
        },
        {
            emit: 'event',
            level: 'error'
        },
        {
            emit: 'event',
            level: 'info'
        },
        {
            emit: 'event',
            level: 'warn'
        }
    ]
})

// Set up Prisma event listeners
prisma.$on('query', (e) => {
    if (process.env.NODE_ENV === 'development') {
        logger.debug(`Query: ${e.query}`)
        logger.debug(`Params: ${e.params}`)
        logger.debug(`Duration: ${e.duration}ms`)
    }
})

prisma.$on('error', (e) => {
    logger.error('Database error: ', e)
})

prisma.$on('info', (e) => {
    logger.info('Database info: ', e.message)
})

prisma.$on('warn', (e) => {
    logger.warn('Database warning: ', e.message)
})

// Database connection test
const testConnection = async () => {
    try {
        await prisma.$queryRaw`SELECT 1`
        logger.info('Database connection established successfully')
        return true
    } catch (error) {
        logger.error('Database disconnection failed: ', error)
        return false
    }
}

//Graceful shutdown
const disconnectDatabase = async () => {
    try {
        await prisma.$disconnect()
        logger.info('Database disconnected successfully')
    } catch (error) {
        logger.error('Database connection failed: ', error)
    }
}

// Database configuration object
const dbConfig = {
    client: prisma,
    testConnection,
    disconnect: disconnectDatabase,

    // Database helper functions
    helpers: {
        // Pagination helper
        paginate: (page = 1, limit = 10) => ({
            skip: (page - 1) * limit,
            take: limit
        }),

        // Transaction wrapper
        transaction: async (callback) => {
            return await prisma.$transaction(callback)
        },

        // Health check
        healthCheck: async () => {
            try {
                const result = await prisma.$queryRaw`SELECT NOW() as current_time`
                return {
                    status: 'healthy',
                    timestamp: result[0].current_time
                }
            } catch (error) {
                return {
                    status: 'unhealthy',
                    error: error.message
                }
            }
        }
    }
}

// Initialize connection on startup
testConnection()

// Handle graceful shutdown
process.on('beforeExit', disconnectDatabase)
process.on('SIGINT', disconnectDatabase)
process.on('SIGTERM', disconnectDatabase)


module.exports = { dbConfig }