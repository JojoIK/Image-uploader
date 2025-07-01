const { z } = require("zod")
const { extendZodWithOpenApi } = require("@asteasolutions/zod-to-openapi");
const { OpenAPIRegistry, OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
const swaggerUi = require("swagger-ui-express")
const { envConfig } = require("./envConfig")
const logger = require('../utils/logger');
const {
    ImageMetadata,
    UploadResponse,
    ErrorResponse
} = require("../utils/zodSchema");

extendZodWithOpenApi(z) // Enable OpenAPI metadata

// Create registry and register schemas
const registry = new OpenAPIRegistry()

// Reegister Schema
registry.register('ImageMetadata', ImageMetadata)
registry.register('UploadResponse', UploadResponse)
registry.register('ErrorResponse', ErrorResponse)

// Register API paths 
registry.registerPath({
    method: 'post',
    path: '/api/v1/images/upload',
    summary: 'Upload a single image',
    tag: ['Upload'],
    responses: {
        201: {
            description: 'Image uploaded',
            content: { 'application/json': { schema: UploadResponse } }
        },
        400: {
            description: 'Validation or upload error',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'post',
    path: '/api/v1/images/upload/multiple',
    summary: 'Upload multiple images',
    tag: ['Upload'],
    responses: {
        201: {
            description: 'Batch upload completed',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        },
        400: {
            description: 'File validation error',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'get',
    path: '/api/v1/images/{id}',
    summary: 'Get image by ID',
    tag: ['Images'],
    request: {
        params: z.object({ id: z.string().uuid().openapi({ description: 'Image ID' }) })
    },
    responses: {
        200: {
            description: 'Successful image retieval',
            content: { 'application/json': { schema: UploadResponse } }
        },
        401: {
            description: 'Image not found',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'delete',
    path: '/api/v1/images/{id}',
    summary: 'Delete image by ID',
    tag: ['Images'],
    request: {
        params: z.object({ id: z.string().uuid().openapi({ description: 'Image ID' }) })
    },
    responses: {
        200: {
            description: 'Image deleted',
            content: { 'application/json': { schema: z.object({ success: z.literal(true), message: z.string() }).openapi({}) } }
        },
        404: {
            description: 'Image not found',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'get',
    path: '/api/v1/images',
    summary: 'List all images for authenticated user',
    tag: ['Images'],
    responses: {
        200: {
            description: 'Images listed',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        }
    }
})

registry.registerPath({
    method: 'get',
    path: '/api/v1/images/{id}/transformed',
    summary: 'Get transformed version of an image',
    tag: ['Images'],
    request: {
        params: z.object({ id: z.string().uuid().openapi({ description: 'Image ID' }) }),
        query: z.object({
            width: z.string().optional().openapi({ description: 'Target width' }),
            height: z.string().optional().openapi({ description: 'Target height' }),
            format: z.string().optional().openapi({ description: 'Output format' }),
            quality: z.string().optional().openapi({ description: 'Quality 1–100' }),
            rotate: z.string().optional().openapi({ description: 'Rotate degrees' }),
            crop: z.string().optional().openapi({ description: 'Crop JSON' })

        })
    },
    responses: {
        200: {
            description: 'Transformed image',
            content: { 'image/jpeg': { schema: z.any().openapi({ description: 'Binary image data' }) } }
        },
        400: {
            description: 'Invalid transform params',
            content: { 'application/json': { schema: ErrorResponse } }
        },
        404: {
            description: 'Image not found',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'get',
    path: '/api/v1/images/stats',
    summary: 'Get image statistics',
    tags: ['Images'],
    responses: {
        200: {
            description: 'Stats retrieved',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        }
    }
})

// Auth routes
registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/register',
    summary: 'Register a new user',
    tags: ['Auth'],
    responses: {
        201: {
            description: 'User created',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        },
        400: { description: 'Validation error', content: { 'application/json': { schema: ErrorResponse } } }
    }
})

registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/login',
    summary: 'Login user',
    tags: ['Auth'],
    responses: {
        200: {
            description: 'Login successful',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        },
        401: {
            description: 'Invalid credentials',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

registry.registerPath({
    method: 'post',
    path: '/api/v1/auth/logout',
    summary: 'Logout user',
    tags: ['Auth'],
    responses: {
        200: {
            description: 'Logout successful',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        }
    }
})

registry.registerPath({
    method: 'get',
    path: '/api/v1/auth/me',
    summary: 'Get current user',
    tags: ['Auth'],
    responses: {
        200: {
            description: 'User info retrieved',
            content: { 'application/json': { schema: z.object({}).openapi({}) } }
        },
        404: {
            description: 'User not found',
            content: { 'application/json': { schema: ErrorResponse } }
        }
    }
})

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
        url: envConfig.NODE_ENV === 'production' ? 'https://your-production-domain.com/api/v1' : `http://localhost:${envConfig.PORT || 3000}/api/v1`,
        description: envConfig.NODE_ENV === 'production' ? 'Production' : 'Development'
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
        { name: 'Upload', description: 'Upload endpoints' },
        { name: 'Images', description: 'Image routes' },
        { name: 'Auth', description: 'Authentication' }
    ]
})

// Middleware to register Swagger docs
function setupSwaggerDocs(app) {
    if (envConfig.NODE_ENV === 'production' && !envConfig.ENABLE_SWAGGER_IN_PROD) {
        return logger.warn('Swagger docs are disabled in production')
    }

    try {
        console.log('Swagger paths: ', Object.keys(openApiDoc.paths))
        app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc))
        logger.info('Swagger docs available at /docs')
    } catch (err) {
        logger.error('Swagger UI setup failed', err.stack)
    }
}

module.exports = { setupSwaggerDocs }
