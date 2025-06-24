require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');
const { envConfig } = require("./envConfig");

// Custom prisma service wrapper class
class PrismaService {
    constructor() {
        this.client = new PrismaClient({
            log: this.getLogLevels(),
            errorFormat: 'colorless'
        })

        //Set up event listeners for logging
        this.setupEventListeners()
    }

    // Set up logging levels
    getLogLevels() {
        const levels = ['error', 'warn']
        if (envConfig.DB_LOG_QUERY === 'true') levels.push('query')
        if (envConfig.DB_LOG_INFO === 'true') levels.push('info')
        return levels.map(level => ({ emit: 'event', level }))
    }

    // Set up Prisma event listeners
    setupEventListeners() {
        //Log queries in development
        if (envConfig.NODE_ENV === 'development') {
            this.client.$on('query', (e) => {
                logger.debug('Query executed ', {
                    query: e.query,
                    params: e.params,
                    duration: `${e.duration}ms`
                })
            })
        }

        // Log errors
        this.client.$on('error', (e) => {
            logger.error('Database error: ', e)
        })

        // Log info
        this.client.$on('info', (e) => {
            logger.info('Database info: ', e.message)
        })

        // Log warnings
        this.client.$on('warn', (e) => {
            logger.warn('Database warning: ', e.message)
        })
    }

    // Database connection test
    async testConnection(retries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                await this.client.$queryRaw`SELECT 1`
                logger.info('Database connection established successfully')
                return true
            } catch (error) {
                logger.error(`Database connection atempt ${attempt} failed: `, error)
                if (attempt < retries) await new Promise(res => setTimeout(res, delay))
                else return false
            }
        }
    }

    //Graceful shutdown
    async disconnect() {
        try {
            await this.client.$disconnect()
            logger.info('Database disconnected successfully')
        } catch (error) {
            logger.error('Database connection failed: ', error)
            throw error
        }
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.client.$queryRaw`SELECT NOW() as current_time`
            return {
                status: 'healthy',
                timestamp: result[0]?.current_time || new Date().toISOString()
            }
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            }
        }
    }

    // Pagination helper
    static paginate(page = 1, limit = 10) {
        return {
            skip: (page - 1) * limit,
            take: limit,
        }
    }

    // Transaction wrapper
    async transaction(callback) {
        return this.client.$transaction(callback)
    }

    getClient() {
        return this.client
    }
}

//Create singleton instance
const prismaService = new PrismaService()

// Handle graceful shutdown
const gracefulExit = async () => {
    await prismaService.disconnect()
    process.exit(0)
}

process.on('beforeExit', async () => await prismaService.disconnect())
process.on('SIGINT', gracefulExit)
process.on('SIGTERM', gracefulExit)

process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection: ', reason)
})

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception: ', error)
    process.exit(1)
})

module.exports = {
    prisma: prismaService.getClient(),
    dbConfig: {
        client: prismaService.getClient(),
        testConnection: () => prismaService.testConnection(),
        disconnect: () => prismaService.disconnect(),
        helpers: {
            paginate: prismaService.paginate,
            transaction: prismaService.transaction.bind(prismaService),
            healthCheck: () => prismaService.healthCheck()
        }
    }
}