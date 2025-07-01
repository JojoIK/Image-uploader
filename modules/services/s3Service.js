const {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
    CopyObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Config } = require('../../config/s3Config');
const logger = require('../../utils/logger');
const { generateUniqueFilename, extractBasicMetadata } = require('../../utils/helpers');
// const pLimit = require('p-limit');

class S3Service {
    constructor() {
        this.s3Client = s3Config.client
        this.bucketName = s3Config.bucketName
        this.region = s3Config.region
        this.defaultObjectSettings = s3Config.objectSettings

        if (!this.s3Client || !this.bucketName) {
            throw new Error('S3 client or bucket name is not configured properly')
        }
    }

    async uploadFile(fileBuffer, originalName, mimetype, folder = 'uploads', metadata = {}) {
        try {
            const filename = generateUniqueFilename(originalName)
            const key = folder ? `${folder}/${filename}` : filename

            const uploadParams = {
                Bucket: this.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: mimetype,
                ...this.defaultObjectSettings,
                metadata: {
                    originalName,
                    ...Object.fromEntries(Object.entries(metadata).map(([k, v]) => [k.toLowerCase(), v]))
                }
            }

            const command = new PutObjectCommand(uploadParams)
            const result = await this.s3Client.send(command)

            const uploadResult = {
                success: true,
                key,
                filename,
                originalName,
                mimetype,
                size: fileBuffer.length,
                etag: result.ETag,
                location: this.generateS3Url(key),
                uploadDate: new Date().toISOString(),
                ...extractBasicMetadata(fileBuffer, mimetype)
            }

            logger.info('File uploaded to S3', {
                key,
                filename,
                size: fileBuffer.length,
                mimetype
            })

            return uploadResult
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_UPLOAD',
                filename: originalName,
                mimetype
            })
            throw new Error(`Failed to upload file to S3: ${error.message}`)
        }
    }

    async downloadFile(key) {
        try {
            const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key })
            const response = await this.s3Client.send(command)

            const chunks = []

            // Add stream error handling
            response.Body.on('error', (err) => {
                logger.logError(err, { operation: 'S3_DOWNLOAD_STREAM', key })
                throw new Error(`Stream error during S3 download: ${err.message}`)
            })

            for await (const chunk of response.Body) {
                chunks.push(chunk)
            }

            const buffer = Buffer.concat(chunks)

            logger.info('File downloaded from S3', { key, size: buffer.length })
            return buffer
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_DOWNLOAD',
                key
            })
            throw new Error(`Failed to download file from S3: ${error.message}`)
        }
    }

    async deleteFile(key) {
        try {
            const command = new DeleteObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })

            await this.s3Client.send(command)

            logger.info('File deleted from S3', { key })
            return true

        } catch (error) {
            logger.logError(error, {
                operation: 'S3_DELETE',
                key
            })
            throw new Error(`Failed to delete file from S3: ${error.message}`)
        }
    }

    async fileExists(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })

            await this.s3Client.send(command)
            return true
        } catch (error) {
            if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
                return false
            }
            logger.logError(error, {
                operation: 'S3_HEAD_OBJECT',
                key
            })
            throw new Error(`Failed to check file existence: ${error.message}`)
        }
    }

    async getFileMetadata(key) {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key
            })

            const response = await this.s3Client.send(command);

            return {
                key,
                size: response.ContentLength,
                mimetype: response.ContentType,
                lastModified: response.LastModified,
                etag: response.ETag,
                metadata: response.Metadata || {}
            }
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_GET_METADATA',
                key
            })
            throw new Error(`Failed to get file metadata: ${error.message}`)
        }
    }

    async generatePresignedUrl(key, expiresIn = 3600, operation = 'getObject') {
        try {
            let command

            if (operation === 'getObject') {
                command = new GetObjectCommand({
                    Bucket: this.bucketName,
                    Key: key
                })
            } else if (operation === 'putObject') {
                command = new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: key,
                    contentType: 'image/jpeg'
                })
            } else {
                throw new Error(`Unsupported operation: ${operation}`)
            }

            const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn })

            logger.info('Presigned URL generated', {
                key,
                operation,
                expiresIn
            })

            return presignedUrl
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_PRESIGNED_URL',
                key,
                requestedOperation: operation
            })
            throw new Error(`Failed to generate presigned URL: ${error.message}`)
        }
    }

    async uploadMultipleFiles(files, folder = 'uploads') {
        const pLimit = (await import('p-limit')).default
        const limit = pLimit(5)// Limit concurrency

        const uploadPromises = files.map(file =>
            limit(async () => {
                try {
                    if (!file?.buffer) {
                        throw new Error('Missing or invalid file buffer')
                    }

                    if (!file?.mimetype) {
                        throw new Error('Missing file mimetype')
                    }

                    return await this.uploadFile(
                        file.buffer,
                        file.originalName,
                        file.mimetype,
                        folder,
                        file.metadata || {}
                    )
                } catch (err) {
                    // Log detailed context here
                    logger.logError(err, {
                        operation: 'UPLOAD_FILE_FAILURE',
                        file: {
                            name: file.originalName,
                            mimetype: file.mimetype,
                            hasBuffer: !!file.buffer,
                            metadata: file.metadata || {}
                        }
                    })

                    // Rethrow to propagate into results array
                    throw new Error(
                        `Failed to upload "${file.originalName}": ${err.message}`
                    )
                }
            })

        )

        try {
            const results = await Promise.allSettled(uploadPromises)

            const successfulUploads = []
            const failedUploads = []

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    successfulUploads.push(result.value)
                } else {
                    failedUploads.push({
                        file: files[index].originalName,
                        error: result.reason.message
                    })
                }
            })

            logger.info('Batch upload completed', {
                total: files.length,
                successful: successfulUploads.length,
                failed: failedUploads.length
            })

            return {
                successful: successfulUploads,
                failed: failedUploads,
                totalProcessed: files.length
            }
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_BATCH_UPLOAD',
                fileCount: files.length
            })
            throw new Error(`Batch upload failed: ${error.message}`)
        }
    }

    async copyFile(sourceKey, destinationKey, metadata = {}) {
        try {
            const copySource = `${this.bucketName}/${sourceKey}`

            const command = new CopyObjectCommand({
                Bucket: this.bucketName,
                Key: destinationKey,
                CopySource: copySource,
                Metadata: metadata,
                MetadataDirective: Object.keys(metadata).length > 0 ? 'REPLACE' : 'COPY'
            })

            const result = await this.s3Client.send(command)

            logger.info('File copied in S3', {
                sourceKey,
                destinationKey
            })

            return {
                success: true,
                sourceKey,
                destinationKey,
                etag: result.ETag
            }
        } catch (error) {
            logger.logError(error, {
                operation: 'S3_COPY',
                sourceKey,
                destinationKey
            })
            throw new Error(`Failed to copy file: ${error.message}`)
        }
    }

    getBucketRegion() {
        return this.region
    }

    getBucketName() {
        return this.bucketName
    }

    generateS3Url(key) {
        return s3Config.helpers.getPublicUrl(key)
    }
}

module.exports = new S3Service()
