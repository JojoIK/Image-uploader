const { OpenAPIRegistry, OpenApiGeneratorV3 } = require('@asteasolutions/zod-to-openapi');
const swaggerUi = require("swagger-ui-express");
const express = require("express");
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
        title: 'Image Upload and Processing Service API',
        version: '1.0.0',
        description: 'A comprehensive REST API for image upload, processing and management',
        contact: {
            name: 'Joan Ikwen',
            email: 'joanikwen@gmail.com'
        },
        license: {
            name: 'MIT',
            url: ''
        }
    },
    servers: [
        {
            url: process.env.NODE_ENV === 'production'
                ? 'https://your-production-domain.com/api/v1'
                : `http://localhost:${process.env.PORT || 3000}/api/v1`,
            description: process.env.NODE_ENV === 'production'
                ? 'Production server'
                : 'Development server'
        }
    ],
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
        { name: 'Processing', description: 'Image processing and transformation operations' },
        { name: 'Health', description: 'Health check and monitoring endpoints' }
    ]
})

const setupSwaggerDocs = (app) => {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc))
}

module.exports = { openApiDoc, setupSwaggerDocs }
