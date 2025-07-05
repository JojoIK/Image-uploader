const { z } = require("zod");
const { extendZodWithOpenApi } = require("@asteasolutions/zod-to-openapi");

extendZodWithOpenApi(z) // Enable OpenAPI metadata

const ImageMetadata = z.object({
    id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    filename: z.string().openapi({ example: 'image_1234.jpg' }),
    originalName: z.string().openapi({ example: 'original.jpg' }),
    mimeType: z.string().openapi({ example: 'image/jpeg' }),
    size: z.number().openapi({ example: 204800 }),
    width: z.number().optional().openapi({ example: 1920 }),
    height: z.number().optional().openapi({ example: 1080 }),
    s3Key: z.string().openapi({ example: 'uploads/123e4567/image_1234.jpg' }),
    s3Url: z.string().url().openapi({ example: 'https://s3.amazonaws.com/yourbucket/uploads/123e4567/image_1234.jpg' }),
    thumbnailUrl: z.string().url().optional().openapi({ example: 'https://s3.amazonaws.com/yourbucket/uploads/123e4567/thumb_image_1234.jpg' }),
    userId: z.string().uuid().nullable().openapi({ example: 'a1b2c3d4-5678-90ab-cdef-1234567890ab' }),
    tags: z.array(z.string()).openapi({ example: ['nature', 'sunset'] }),
    createdAt: z.string().datetime().openapi({ example: '2025-06-28T14:20:00Z' }),
    updatedAt: z.string().datetime().openapi({ example: '2025-06-28T15:00:00Z' }),
}).openapi({ title: 'ImageMetadata' })

const UploadResponse = z.object({
    success: z.literal(true),
    message: z.string(),
    data: ImageMetadata
}).openapi({ title: 'UploadResponse' })

const RegisterRequest = z.object({
    name: z.string()
        .min(2, 'Name is too short')
        .max(100, 'Name is too long')
        .transform(val => val.trim())
        .openapi({ description: 'Full name', example: 'Joan Ikwen' }),

    email: z.string()
        .email('Invalid email address')
        .transform(val => val.toLowerCase().trim())
        .openapi({ description: 'User email', example: 'joanikwen@gmail.com' }),

    password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(100)
        .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).*/,
            'Password must contain at least one uppercase letter, one lowercase letter, and one digit'
        )
        .openapi({ description: 'Password', example: 'SecurePass123' })
}).openapi({ title: 'RegisterRequest' })

const ErrorResponse = z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.union([z.string(), z.record(z.any())])
}).openapi({ title: 'ErrorResponse' })

module.exports = {
    ImageMetadata,
    UploadResponse,
    RegisterRequest,
    ErrorResponse
}