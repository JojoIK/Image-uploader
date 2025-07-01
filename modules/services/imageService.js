const sharp = require("sharp");
const logger = require("../../utils/logger");
const { getImageDimensions, validateImageDimensions } = require('../../utils/helpers');

class ImageService {
    constructor() {
        // Sharp configuration
        sharp.cache({ memory: 50 })
        sharp.concurrency(1)
    }

    // Get image metadata
    async getImageMetadata(imageBuffer) {
        try {
            const metadata = await sharp(imageBuffer).metadata()

            const imageMetadata = {
                format: metadata.format,
                width: metadata.width,
                height: metadata.height,
                channels: metadata.channels,
                depth: metadata.depth,
                density: metadata.density,
                chromaSubsampling: metadata.chromaSubsampling,
                isProgressive: metadata.isProgressive,
                hasProfile: metadata.hasProfile,
                hasAlpha: metadata.hasAlpha,
                size: imageBuffer.length,
                dimensions: getImageDimensions(metadata)
            }

            logger.info('Image metadata extracted', {
                format: imageMetadata.format,
                dimensions: `${imageMetadata.width}x${imageMetadata.height}`,
                size: imageMetadata.size
            })

            return imageMetadata
        } catch (error) {
            logger.logError(error, {
                operation: 'GET_IMAGE_METADATA',
                bufferSize: imageBuffer.length
            })
            throw new Error(`Failed to extract image metadata: ${error.message}`)
        }
    }

    // Resize image
    async resizeImage(imageBuffer, options = {}) {
        try {
            const {
                width,
                height,
                fit = 'cover',
                position = 'center',
                background = { r: 255, g: 255, b: 255, alpha: 1 },
                withoutEnlargement = true,
                kernel = 'lanczos3'
            } = options

            let sharpInstance = sharp(imageBuffer)

            if (width || height) {
                sharpInstance = sharpInstance.resize(width, height, {
                    fit,
                    position,
                    background,
                    withoutEnlargement,
                    kernel
                })
            }

            const resizedBuffer = await sharpInstance.toBuffer()

            logger.logProcessing({
                operation: 'RESIZE',
                originalSize: imageBuffer.length,
                newSize: resizedBuffer.length,
                dimensions: `${width || 'auto'}x${height || 'auto'}`,
                fit
            })

            return resizedBuffer
        } catch (error) {
            logger.logError(error, {
                operation: 'RESIZE_IMAGE',
                options
            })
            throw new Error(`Failed to resize image: ${error.message}`);
        }
    }

    // Convert image format
    async convertFormat(imageBuffer, format, options = {}) {
        try {
            let sharpInstance = sharp(imageBuffer)

            const lowerFormat = format.toLowerCase()

            const formatOptions = {
                jpeg: () => sharpInstance.jpeg({
                    quality: options.quality ?? 85,
                    progressive: options.progressive ?? true,
                    mozjpeg: options.mozjpeg ?? true
                }),
                png: () => sharpInstance.png({
                    quality: options.quality ?? 90,
                    progressive: options.progressive ?? true,
                    compressionLevel: options.compressionLevel ?? 6
                }),
                webp: () => sharpInstance.webp({
                    quality: options.quality ?? 85,
                    effort: options.effort ?? 4,
                    lossless: options.lossless ?? false
                }),
                avif: () => sharpInstance.avif({
                    quality: options.quality ?? 85,
                    effort: options.effort ?? 4,
                    lossless: options.lossless ?? false
                }),
                tiff: sharpInstance.tiff({
                    quality: options.quality ?? 85,
                    compression: options.compression ?? 'jpeg'
                }),
                gif: () => {
                    // Sharp doesn't support GIF output, convert to PNG
                    logger.warn("GIF output not supported. Converting to PNG instead")
                    return sharpInstance.png() // fallback
                }
            }

            if (!formatOptions[lowerFormat]) {
                throw new Error(`Unsupported format: ${format}`)
            }

            sharpInstance = formatOptions[lowerFormat]()
            const convertedBuffer = await sharpInstance.toBuffer()

            logger.logProcessing({
                operation: 'FORMAT_CONVERSION',
                targetFormat: lowerFormat,
                originalSize: imageBuffer.length,
                newSize: convertedBuffer.length,
                options
            })

            return convertedBuffer
        } catch (error) {
            logger.logError(error, {
                operation: 'CONVERT_FORMAT',
                format,
                options
            })
            throw new Error(`Failed to convert image format: ${error.message}`);
        }
    }

    // Create thumbnail versions

    async createThumbnails(imageBuffer, sizes = [], format = 'webp') {
        try {
            const defaultSizes = [
                { name: 'small', width: 150, height: 150 },
                { name: 'medium', width: 300, height: 300 },
                { name: 'large', width: 600, height: 600 }
            ]

            const sizesToProcess = sizes.length > 0 ? sizes : defaultSizes
            const thumbnails = {}

            for (const size of sizesToProcess) {
                //resoze the image
                const thumbnailBuffer = await this.resizeImage(imageBuffer, {
                    width: size.width,
                    height: size.height,
                    fit: size.fit || 'cover',
                    withoutEnlargement: size.withoutEnlargement !== false
                })

                // Convert format 
                const convertedBuffer = await this.convertFormat(resizedBuffer, format)

                thumbnails[size.name] = {
                    buffer: convertedBuffer,
                    width: size.width,
                    height: size.height,
                    size: convertedBuffer.length,
                    format
                }
            }

            logger.logProcessing({
                operation: 'CREATE_THUMBNAILS',
                thumbnailCount: Object.keys(thumbnails).length,
                sizes: sizesToProcess.map(s => `${s.name}:${s.width}x${s.height}`),
                format
            })

            return thumbnails
        } catch (error) {
            logger.logError(error, {
                operation: 'CREATE_THUMBNAILS',
                sizes,
                format
            })
            throw new Error(`Failed to create thumbnails: ${error.message}`)
        }
    }

    // Apply image transformations
    async applyTransformations(imageBuffer, transformations = {}) {
        try {
            let sharpInstance = sharp(imageBuffer)

            // Rotation
            if (transformations.rotate) {
                sharpInstance = sharpInstance.rotate(transformations.rotate, {
                    background: transformations.rotateBackground || { r: 255, g: 255, b: 255, alpha: 1 }
                })
            }

            // Flip
            if (transformations.flip) sharpInstance = sharpInstance.flip()

            // Flop
            if (transformations.flop) sharpInstance = sharpInstance.flop()

            // Sharpen
            if (transformations.sharpen) {
                const { sigma = 1, flat = 1, jagged = 2 } = transformations.sharpen
                sharpInstance = sharpInstance.sharpen(sigma, flat, jagged)
            }

            // Blur
            if (transformations.blur) sharpInstance = sharpInstance.blur(transformations.blur)

            // Brightness and contrast
            if (transformations.modulate) sharpInstance = sharpInstance.modulate(transformations.modulate)

            // Grayscale
            if (transformations.grayscale) sharpInstance = sharpInstance.grayscale()

            // Negate
            if (transformations.negate) sharpInstance = sharpInstance.negate()

            // Crop
            if (transformations.crop) {
                const { left, top, width, height } = transformations.crop
                if ([left, top, width, height].some(v => typeof v !== 'number' || v < 0)) {
                    throw new Error('Invalid crop parameters')
                }
                sharpInstance = sharpInstance.extract({ left, top, width, height })
            }

            // Tint
            if (transformations.tint) sharpInstance = sharpInstance.tint(transformations.tint)

            const transformedBuffer = await sharpInstance.toBuffer()

            logger.logProcessing({
                operation: 'APPLY_TRANSFORMATIONS',
                transformations: Object.keys(transformations),
                originalSize: imageBuffer.length,
                newSize: transformedBuffer.length
            })

            return transformedBuffer
        } catch (error) {
            logger.logError(error, {
                operation: 'APPLY_TRANSFORMATIONS',
                transformations
            })
            throw new Error(`Failed to apply transformations: ${error.message}`)
        }
    }

    // Optimize image for web
    async optimizeForWeb(imageBuffer, options = {}) {
        try {
            const {
                format = 'webp',
                quality = 85,
                maxWidth = 1920,
                maxHeight = 1080,
                progressive = true
            } = options

            const metadata = await sharp(imageBuffer).metadata()
            let sharpInstance = sharp(imageBuffer)

            // Resize if larger than max dimensions
            if (metadata.width > maxWidth || metadata.height > maxHeight) {
                sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
            }

            // Apply format-specific optimization
            switch (format) {
                case 'webp':
                    sharpInstance = sharpInstance.webp({ quality, effort: 6, lossless: false })
                    break

                case 'jpeg':
                    sharpInstance = sharpInstance.jpeg({ quality, progressive, mozjpeg: true })
                    break

                case 'png':
                    sharpInstance = sharpInstance.png({ quality, progressive, compressionLevel: 9 })
                    break

                case 'avif':
                    sharpInstance = sharpInstance.avif({ quality, effort: 6 })
                    break

                default:
                    throw new Error(`Unsupported optimization format: ${format}`)
            }

            const optimizedBuffer = await sharpInstance.toBuffer()
            const compressionRatio = ((imageBuffer.length - optimizedBuffer.length) / imageBuffer.length * 100).toFixed(2)

            logger.logProcessing({
                operation: 'OPTIMIZE_FOR_WEB',
                originalSize: imageBuffer.length,
                optimizedSize: optimizedBuffer.length,
                compressionRatio: `${compressionRatio}%`,
                format
            })

            return optimizedBuffer
        } catch (error) {
            logger.logError(error, {
                operation: 'OPTIMIZE_FOR_WEB',
                options
            })
            throw new Error(`Failed to optimize image for web: ${error.message}`)
        }
    }

    // Validate image constraints
    async validateImage(imageBuffer, constraints = {}) {
        try {
            const metadata = await sharp(imageBuffer).metadata()
            const result = validateImageDimensions(metadata, constraints)
            if (!result.isValid) {
                throw new Error(result.errors.join('; '))
            }

            const supportedFormats = ['jpeg', 'png', 'webp', 'tiff', 'avif', 'gif']
            if (!supportedFormats.includes(metadata.format)) {
                throw new Error(`Unsupported image format: ${metadata.format}`)
            }

            // Validate file size
            const maxSize = constraints.maxSize || 10 * 1024 * 1024 // 10MB default
            if (imageBuffer.length > maxSize) {
                throw new Error(`Image exceeds maximum size of ${maxSize} bytes`)
            }

            logger.logProcessing({
                operation: 'VALIDATE_IMAGE',
                format: metadata.format,
                size: imageBuffer.length,
                constraints
            })

            return true
        } catch (error) {
            logger.logError(error, {
                operation: 'VALIDATE_IMAGE',
                constraints
            })
            throw new Error(`Failed to validate image: ${error.message}`);
        }
    }
}


module.exports = ImageService