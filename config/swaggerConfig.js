const { OpenAPIRegistry, OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
const swaggerUi = require("swagger-ui-express")
const { envConfig } = require("./envConfig")
const {
    ImageMetadata,
    UploadResponse,
    ErrorResponse
} = require("../schemas/zodSchema");
const logger = require('../utils/logger');

// Create registry and register schemas
const registry = new OpenAPIRegistry()
registry.register('ImageMetadata', ImageMetadata)
registry.register('UploadResponse', UploadResponse)
registry.register('ErrorResponse', ErrorResponse)

// Build document 
const generator = new OpenApiGeneratorV3(registry.definitions)
const openApiDoc = generator.generateDocument({
    openapi: '3.0.0',
    info: {
        title: 'Image Upload API',
        version: '1.0.0',
        contact: {
            name: 'Joan Ikwen',
            email: 'joanikwen@gmail.com'
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
        }
    },
    servers: [{
        url: envConfig.NODE_ENV === 'production'
            ? 'https://your-production-domain.com/api/v1'
            : `http://localhost:${envConfig.PORT || 3000}/api/v1`,
        description: envConfig.NODE_ENV === 'production'
            ? 'Production server'
            : 'Development server'
    }],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    },
    tags: [
        { name: 'Upload', description: 'Image upload operations' },
        { name: 'Images', description: 'Image management and retrieval operations' },
        { name: 'Health', description: 'Health check and monitoring endpoints' }
    ]
})

// Middleware to register Swagger docs
function setupSwaggerDocs(app) {
    if (envConfig.NODE_ENV === 'production' && !envConfig.ENABLE_SWAGGER_IN_PROD) {
        return logger.warn('Swagger docs are disabled in production')
    }

    try {
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc))
        logger.info('Swagger docs available at /docs')
    } catch (err) {
        logger.error('Failed to set up swagger UI: ', err)
    }
}

module.exports = { openApiDoc, setupSwaggerDocs }
