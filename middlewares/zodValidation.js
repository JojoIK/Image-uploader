const { z } = require("zod");
const logger = require("../utils/logger");
const { BadRequestException } = require("../utils/appError");

// Common validation schemas
const commonSchemas = {
    uuid: z.string().uuid('Invalid UUID format'),
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
    filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
    tags: z.array(z.string().trim().min(1)).max(20, 'Maximum 20 tags allowed').optional(),
    page: z.coerce.number().refine(val => val > 0, 'Page must be positive').optional(),
    limit: z.coerce.number().refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional()
}

// Image processing validation schemas
const imageProcessingSchemas = {
    dimensions: z.object({
        width: z.number().int().min(1).max(5000).optional(),
        height: z.number().int().min(1).max(5000).optional()
    }).optional(),

    quality: z.number().int().min(1).max(100).optional(),

    format: z.enum(['jpeg', 'png', 'webp']).optional(),

    cropParams: z.object({
        x: z.number().int().min(0),
        y: z.number().int().min(0),
        width: z.number().int().min(1),
        height: z.number().int().min(1)
    }).optional(),

    rotationAngle: z.number().min(-360).max(360).optional()
}

// User registration validation
const userRegistrationSchema = z.object({
    email: commonSchemas.email,
    password: commonSchemas.password,
    username: z.string().min(3, 'Username must be at least 3 characters')
        .max(50, 'Username too long')
        .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
        .optional(),
    firstName: z.string().min(1, 'First name is required').max(100, 'First name too long').optional(),
    lastName: z.string().min(1, 'Last name is required').max(100, 'Last name too long').optional()
})

// User login validation
const userLoginSchema = z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required')
})

// Image upload validation
const imageUploadSchema = z.object({
    description: z.string().max(1000, 'Description too long').optional(),
    altText: z.string().max(500, 'Alt text too long').optional(),
    tags: commonSchemas.tags,
    isPublic: z.boolean().optional().default(true)
})

// Image update validation
const imageUpdateSchema = z.object({
    description: z.string().max(1000, 'Description too long').optional(),
    altText: z.string().max(500, 'Alt text too long').optional(),
    tags: commonSchemas.tags
})

// Image processing request validation
const imageProcessingSchema = z.object({
    type: z.enum(['thumbnail', 'medium', 'large', 'custom', 'crop', 'resize', 'compress']),
    dimensions: imageProcessingSchemas.dimensions,
    quality: imageProcessingSchemas.quality,
    format: imageProcessingSchemas.format,
    cropParams: imageProcessingSchemas.cropParams,
    rotationAngle: imageProcessingSchemas.rotationAngle,
    preserveMetadata: z.boolean().optional().default(false)
})

// Image search validation
const imageSearchSchema = z.object({
    query: z.string().max(200, 'Search query too long').optional(),
    tags: z.string().transform(str => str.split(',').map(tag => tag.trim())).optional(),
    mimeType: z.string().optional(),
    minSize: z.coerce.number().refine(val => val >= 0, 'Min size must be non-negative').optional(),
    maxSize: z.coerce.number().refine(val => val >= 0, 'Max size must be non-negative').optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: commonSchemas.page,
    limit: commonSchemas.limit,
    sortBy: z.enum(['createdAt', 'updatedAt', 'size', 'filename']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
})

// Bulk operation validation
const bulkOperationSchema = z.object({
    imageIds: z.array(commonSchemas.uuid).min(1, 'At least one image ID is required').max(50, 'Maximum 50 images allowed in bulk operation'),
    operation: z.enum(['delete', 'process', 'tag', 'move']),
    parameters: z.object({}).passthrough().optional()
})

// Generic validation middleware
const createValidationMiddleware = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const dataToValidate = req[source]
            const validatedData = schema.parse(dataToValidate)

            req[source] = validatedData
            next()
        } catch (error) {
            if (error instanceof z.ZodError) {
                const formattedErrors = error.errors.map(err => ({
                    field: err.path.join('.'),
                    message: err.message,
                    code: err.code
                }))

                logger.warn('Validation failed: %O', formattedErrors)

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: formattedErrors
                })
            }

            logger.error('Unexpected validation error: %O, error')
            next(error)
        }
    }
}

// Middleware instances
const validateUserRegistration = createValidationMiddleware(userRegistrationSchema)
const validateUserLogin = createValidationMiddleware(userLoginSchema)
const validateImageUpload = createValidationMiddleware(imageUploadSchema)
const validateImageUpdate = createValidationMiddleware(imageUpdateSchema)
const validateImageProcessing = createValidationMiddleware(imageProcessingSchema)
const validateImageSearch = createValidationMiddleware(imageSearchSchema, 'query')
const validateBulkOperation = createValidationMiddleware(bulkOperationSchema)

// Parameter validation
const validateParams = (schema) => createValidationMiddleware(schema, 'params')
const validateQuery = (schema) => createValidationMiddleware(schema, 'query')

// File metadata validation
const validateFileMetadata = (file) => {
    const fileSchema = z.object({
        fieldname: z.string(),
        originalname: z.string().min(1, 'Original filename is required'),
        encoding: z.string(),
        mimetype: z.string().refine(
            (type) => ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(type),
            'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'
        ),
        size: z.number().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
        buffer: z.instanceof(Buffer)
    })

    try {
        return fileSchema.parse(file)
    } catch (err) {
        if (err instanceof z.ZodError) throw new BadRequestException(err.errors?.[0]?.message)
        throw err
    }
}

// Sanitization helpers
const sanitizeFilename = (filename) => {
    return filename
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_{2,}/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/[\x00-\x1F\x7F]+/g, '')
        .substring(0, 255)
}

const sanitizeString = (str, maxLength = 1000) => {
    if (typeof str !== 'string') return ''
    return str.trim().substring(0, maxLength)
}

module.exports = {
    // Schemas
    schemas: {
        userRegistration: userRegistrationSchema,
        userLogin: userLoginSchema,
        imageUpload: imageUploadSchema,
        imageUpdate: imageUpdateSchema,
        imageProcessing: imageProcessingSchema,
        imageSearch: imageSearchSchema,
        bulkOperation: bulkOperationSchema,
        common: commonSchemas
    },

    //Middlewares
    validateUserRegistration,
    validateUserLogin,
    validateImageUpload,
    validateImageUpdate,
    validateImageProcessing,
    validateImageSearch,
    validateBulkOperation,

    //Generics
    validateParams, // validateImageId(/images/:id), validateUserId(/users/:userId)
    validateQuery,
    createValidationMiddleware,

    // File validation
    validateFileMetadata,

    // Helpers
    sanitizeFilename,
    sanitizeString
}