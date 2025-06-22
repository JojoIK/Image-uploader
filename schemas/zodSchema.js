const { z } = require("zod");
const { extendZodWithOpenApi } = require("@asteasolutions/zod-to-openapi");

extendZodWithOpenApi(z) // Enable OpenAPI metadata

const ImageMetadata = z.object({
    id: z.string().uuid().openapi({ example: '123e4567-e89b-12d3-a456-426614174000' }),
    filename: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    size: z.number(),
    width: z.number(),
    height: z.number(),
    s3Key: z.string(),
    s3Url: z.string().url(),
    thumbnailUrl: z.string().url(),
    userId: z.string().uuid().nullable(),
    tags: z.array(z.string()),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
}).openapi({ title: 'ImageMetadata' })

const UploadResponse = z.object({
    success: z.literal(true),
    message: z.string(),
    data: ImageMetadata
}).openapi({ title: 'UploadResponse' })

const ErrorResponse = z.object({
    success: z.literal(false),
    message: z.string(),
    error: z.string()
}).openapi({ title: 'ErrorResponse' })

module.exports = {
    ImageMetadata,
    UploadResponse,
    ErrorResponse
}