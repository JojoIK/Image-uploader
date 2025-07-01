// server.js
require("dotenv").config();
const http = require("node:http");

const app = require("./app");
const logger = require("./utils/logger");
const { dbConfig } = require("./config/dbConfig");
const { envConfig } = require("./config/envConfig");

const PORT = envConfig.PORT || 3000;

let server

// Server startup
(async () => {
    try {
        logger.info('Testing DB connection...')
        const dbReady = await dbConfig.testConnection()
        if (!dbReady) {
            logger.error('Unable to connect to the database. Shutting down...')
            process.exit(1)
        }
        server = http.createServer(app).listen(PORT, function (err) {
            if (err) {
                logger.error('Server start error: ', err)
            } else {
                const host = server.address().address
                const port = server.address().port
                logger.info(`Server running on ${host}: ${port}`)
                logger.info(`Swagger docs: http://localhost:${port}/docs`)
            }
            // Global crash handlers
            process.on('uncaughtException', (err) => {
                console.error('Uncaught Exception: ', err)
                process.exit(1) // Mandatory to prevent undefined state
            })

            process.on('unhandledRejection', (reason, promise) => {
                logger.error('Unhandled Rejection: ', reason)
                process.exit(1)
            })
        })
    } catch (err) {
        logger.error('Statup failed: ', err)
        process.exit(1)
    }
})()

// Graceful shutdown
const shutdown = async () => {
    logger.info('Gracefully shutting down...')
    await dbConfig.disconnect()
    if (server) {
        server.close(() => {
            logger.info('Server closed')
            process.exit(0)
        })
    } else {
        logger.warn("No server instance to close")
        process.exit(0)
    }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)