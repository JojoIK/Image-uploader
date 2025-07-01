const { prisma } = require("../../config/dbConfig");
const s3Service = require("../services/s3Service");
const ImageService = require("../services/imageService");
const { createResponse, formatFileSize } = require("../../utils/helpers");
const logger = require("../../utils/logger");
const { HTTP_STATUS } = require("../../config/httpConfig");
const imageService = new ImageService()

class ImageUploadController {
    // Upload single image
    async uploadImage(req, res) {
        try {
            if (!req.file) {
                return res
                    .status(HTTP_STATUS.BAD_REQUEST)
                    .json(createResponse(false, 'No file uploaded', null, 'FILE_REQUIRED'))
            }

            const { buffer, originalname, mimetype } = req.file
            const userId = req.user?.id || null

            // Validate image
            const validation = await imageService.validateImage(buffer, {
                minWidth: 50,
                minHeight: 50,
                maxWidth: 5000,
                maxHeight: 5000,
                maxSize: 10 * 1024 * 1024, // 10MB
                allowedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif']
            })

            if (!validation.isValid) {
                return res
                    .status(HTTP_STATUS.BAD_REQUEST)
                    .json(
                        createResponse(false, 'validation failed', null, {
                            code: 'VALIDATION_ERROR',
                            details: validation.errors
                        })
                    )
            }

            // Get image metadata
            const metadata = await imageService.getImageMetadata(buffer)

            // Upload original image to S3
            const originalUpload = await s3Service.uploadFile(
                buffer,
                originalname,
                mimetype,
                'images',
                {
                    width: metadata.width.toString(),
                    height: metadata.height.toString(),
                    format: metadata.format
                }
            )

            // Create thumbnails
            const thumbnails = await imageService.createThumbnails(buffer)

            // Upload thumbnails to S3
            const thumbnailUploads = await Promise.all(
                Object.entries(thumbnails).map(async ([size, thumb]) => {
                    const upload = await s3Service.uploadFile(
                        thumb.buffer,
                        `${size}_${originalUpload.filename}`,
                        'image/webp',
                        `thumbnails/${size}`,
                        {
                            width: thumb.width.toString(),
                            height: thumb.height.toString(),
                            parentKey: originalUpload.key,
                            userId: userId?.toString()
                        }
                    )

                    return { size, ...upload, dimensions: { width: thumb.width, height: thumb.height } }
                })
            )

            // Save to database
            const imageRecord = await prisma.image.create({
                data: {
                    originalName: originalname,
                    filename: originalUpload.filename,
                    s3Key: originalUpload.key,
                    mimetype,
                    size: buffer.length,
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    url: originalUpload.location,
                    userId,
                    metadata: {
                        ...metadata,
                        thumbnails: thumbnailUploads.reduce((acc, t) => {
                            acc[t.size] = {
                                s3key: t.key,
                                url: t.location,
                                dimensions: t.dimensions
                            }
                            return acc
                        }, {})
                    }
                }
            })

            return res.status(HTTP_STATUS.CREATED).json(
                createResponse(true, 'Image uploaded successfully', {
                    id: imageRecord.id,
                    filename: imageRecord.filename,
                    url: imageRecord.url,
                    thumbnails: thumbnailUploads.map(t => ({
                        size: t.size,
                        url: t.location,
                        dimensions: t.dimensions
                    }))
                })
            )
        } catch (error) {
            logger.logError(error, { operation: 'UPLOAD_SINGLE', userId: req.user?.id })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Upload failed', null, error.message)
            )
        }
    }

    // Upload multiple images
    async uploadMultiple(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json(createResponse(false, 'No files uploaded', null, 'FILES_REQUIRED'))
            }

            const userId = req.user?.id || null
            const results = []
            const errors = []

            for (const file of req.files) {
                try {
                    // Validate each image
                    const validation = await imageService.validateImage(file.buffer, {
                        maxFileSize: 10 * 1024 * 1024,
                        allowedFormats: ['jpeg', 'jpg', 'png', 'webp', 'gif']
                    })

                    if (!validation.isValid) {
                        errors.push({ file: file.originalname, error: 'validation failed', details: validation.errors })
                        continue
                    }

                    const metadata = validation.metadata


                    const originalUpload = await s3Service.uploadFile(file.buffer, file.originalname, file.mimetype, 'images', {
                        userId: userId?.toString()
                    })

                    // Generate thumbnails
                    const thumbnails = await imageService.createThumbnails(file.buffer)

                    // Upload thumbnails
                    const thumbUploads = await Promise.all(Object.entries(thumbnails).map(async ([size, thumb]) => {
                        const upload = await s3Service.uploadFile(
                            thumb.buffer,
                            `${size}_${originalUpload.filename}`,
                            'image/webp',
                            `thumbnails/${size}`,
                            {
                                width: thumb.width.toString(),
                                height: thumb.height.toString(),
                                parentKey: originalUpload.key
                            }
                        )
                        return { size, url: upload.location }
                    }))

                    // Save to database
                    const imageRecord = await prisma.image.create({
                        data: {
                            originalName: file.originalname,
                            filename: originalUpload.filename,
                            s3Key: originalUpload.key,
                            mimetype: file.mimetype,
                            size: file.size,
                            width: metadata.width,
                            height: metadata.height,
                            format: metadata.format,
                            url: originalUpload.location,
                            userId
                        }
                    })

                    results.push({
                        id: imageRecord.id,
                        originalName: file.originalname,
                        url: originalUpload.location,
                        thumbnails: thumbUploads
                    })
                } catch (err) {
                    errors.push({ file: file.originalname, error: err.message })
                }
            }

            return res.status(HTTP_STATUS.OK).json(
                createResponse(true, 'Batch upload completed', { successful: results, failed: errors })
            )
        } catch (error) {
            logger.logError(error, { operation: 'UPLOAD_MULTIPLE', userId: req.user?.id })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Batch upload failed', null, error.message)
            )
        }
    }

    // Get image by ID
    async getImageById(req, res) {
        try {
            const { id } = req.params
            const userId = req.user?.id

            const image = await prisma.image.findFirst({
                where: { id, ...(userId && { userId }) } // Filter by user if authenticated
            })

            if (!image) {
                return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, 'Image not found'))
            }

            return res.status(HTTP_STATUS.OK).json(
                createResponse(true, 'Image retrieved successfully', {
                    ...image,
                    size: formatFileSize(image.size)
                })
            )
        } catch (error) {
            logger.logError(error, { operation: 'GET_IMAGE', imageId: req.params.id })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Failed to retrieve image', null, error.message)
            )
        }
    }

    // Get user image with pagination
    async getUserImages(req, res) {
        try {
            const userId = req.user?.id
            const page = parseInt(req.query.page) || 1
            const limit = Math.min(parseInt(req.query.limit) || 10, 50) // Max 50 items per page
            const offset = (page - 1) * limit

            const [images, total] = await Promise.all([
                prisma.image.findMany({
                    where: { userId },
                    take: limit,
                    skip: offset,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.image.count({ where: { userId } })
            ])

            const totalPages = Math.ceil(total / limit)

            return res.status(HTTP_STATUS.OK).json(
                createResponse(true, 'Images retrieved successfully', {
                    images,
                    pagination: {
                        total,
                        page,
                        totalPages,
                        hasNext: page < totalPages,
                        hasPrev: page > 1
                    }
                })
            )
        } catch (error) {
            logger.logError(error, { operation: 'GET_IMAGES', userId: req.user?.id })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createResponse(false, 'Error retrieving images', null, error.message))
        }
    }

    // Delete image
    async deleteImage(req, res) {
        try {
            const { id } = req.params
            const userId = req.user?.id

            const image = await prisma.image.findFirst({ where: { id, userId } })
            if (!image) return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, 'Image not found'))

            // Delete from S3
            await s3Service.deleteFile(image.s3Key)

            // Delete thumbnails from S3
            const thumbnails = image.metadata?.thumbnails
            if (thumbnails) {
                const keys = Object.values(thumbnails).map(t => t.s3Key)
                await s3Service.deleteMultipleFiles(keys)
            }

            // Delete from database
            await prisma.image.delete({ where: { id } })

            return res.status(HTTP_STATUS.OK).json(createResponse(true, 'Image deleted', { id }));
        } catch (error) {
            logger.logError(error, { operation: 'DELETE_IMAGE', imageId: req.params.id });
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createResponse(false, 'Failed to delete image', null, error.message));
        }
    }

    // Transform image with parameters
    async transformImage(req, res) {
        try {
            const { id } = req.params
            const { width, height, format = 'jpeg', quality = 80, rotate, crop } = req.query
            const userId = req.user?.id

            const image = await prisma.image.findFirst({ where: { id, userId } })
            if (!image) return res.status(HTTP_STATUS.NOT_FOUND).json(createResponse(false, 'Image not found'))

            // Get original image from S3
            const originalBuffer = await s3Service.getFile(image.s3Key)

            // Apply transformations
            const transformed = await imageService.transformImage(originalBuffer, {
                width: parseInt(width),
                height: parseInt(height),
                format,
                quality: parseInt(quality),
                rotate: parseInt(rotate),
                crop: crop ? JSON.parse(crop) : undefined
            })

            // Set appropriate headers
            res.set({
                'Content-Type': `image/${format}`,
                'Content-Length': transformed.length,
                'Cache-Control': 'public, max-age=31536000'
            })

            return res.send(transformed)
        } catch (error) {
            logger.logError(error, { operation: 'TRANSFORM_IMAGE', imageId: req.params.id });
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createResponse(false, 'Failed to transform image', null, error.message));
        }
    }

    //  Get image analytics/stats
    async getImageStats(req, res) {
        try {
            const userId = req.user?.id;

            const [totalImages, totalSize, formats, recentUploads] = await Promise.all([
                prisma.image.count({ where: { userId } }),
                prisma.image.aggregate({ where: { userId }, _sum: { size: true } }),
                prisma.image.groupBy({ by: ['format'], where: { userId }, _count: { format: true } }),
                prisma.image.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                    select: { id: true, originalName: true, size: true, createdAt: true }
                })
            ])

            return res.status(HTTP_STATUS.OK).json(createResponse(true, 'Stats retrieved', {
                totalImages,
                totalSize: {
                    bytes: totalSize._sum.size || 0,
                    formatted: formatFileSize(totalSize._sum.size || 0)
                },
                formatDistribution: formats.map(f => ({ format: f.format, count: f._count.format })),
                recentUploads
            }))
        } catch (error) {
            logger.logError(error, { operation: 'GET_STATS', userId: req.user?.id })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(createResponse(false, 'Failed to fetch stats', null, error.message))
        }
    }
}
const uploadController = new ImageUploadController()

module.exports = uploadController