//app.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const path = require("path");

// Configs
const { envConfig } = require("./config/envConfig");
const { HTTP_STATUS } = require("./config/httpConfig");

// Utilities
const logger = require("./utils/logger");
const { createResponse } = require("./utils/helpers");

// Middlewares
const errorHandler = require("./middlewares/errorHandler");
const { generalRateLimit } = require("./middlewares/rateLimiter");

// Routes
const authRoutes = require("./modules/route/authRoute");
const uploadRoutes = require("./modules/route/uploadRoute");

// Swagger
const { setupSwaggerDocs } = require("./config/swaggerConfig");

const app = express()

//security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

// CORS config
app.use(cors(
    {
        //origin: envConfig.allowedOrigins.length > 0 ? envConfig.allowedOrigins : ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    }
))

// Body Parsers
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Custom Logger Middleware (request logging)
app.use((req, res, next) => {
    logger.info(`Incoming request: ${req.method} ${req.path}`)
    next()
})

// Swagger docs
try {
    setupSwaggerDocs(app);
} catch (err) {
    logger.error('Failed to initialize Swagger docs:', err.message)
}

// Health Check
app.get('/health', async (req, res) => {
    const { dbConfig } = require("./config/dbConfig");
    const dbHealth = await dbConfig.helpers.healthCheck()
    return res.status(HTTP_STATUS.OK).json(
        createResponse(true, 'Service is healthy', {
            service: 'image-upload-processing-service',
            db: dbHealth
        })
    )
})

// Global rate limiter
app.use(generalRateLimit)

// API Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/upload', uploadRoutes)

// Serve public images
app.use("/public", express.static(path.join(__dirname, 'public')))

// Catch-all 404
app.use((req, res) => {
    return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, 'Route not found'))
})

// Global error handling
app.use(errorHandler)


module.exports = app