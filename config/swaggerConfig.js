const { OpenAPIRegistry, OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
const swaggerUi = require("swagger-ui-express");
const { envConfig } = require("./envConfig")
const {
    ImageMetadata,
    UploadResponse,
    ErrorResponse
} = require("../schemas/zodSchema");

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
            url: ''
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

function setupSwaggerDocs(app) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc))
}

module.exports = { openApiDoc, setupSwaggerDocs }
