require("dotenv").config();
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
const { envConfig } = require("./envConfig");
const logger = require('../utils/logger');

//Destructive Config
const { region, credentials, bucketName } = envConfig.s3

// Initialize S3 Client
const s3Client = new S3Client({
    region,
    credentials,
    requestHandler: {
        requestTimeout: 30000, //30 seconds
        httpsAgent: { maxSockets: 25 }
    },
    maxAttempts: 3
})

// Base S3 configuration
const s3Config = Object.freeze({
    client: s3Client,
    bucketName,
    region,

    // S3 folder structure
    folders: {
        originals: 'images/originals',
        thumbnails: 'images/thumbnails',
        processed: 'images/processed',
        temp: 'images/temp'
    },

    // Content types mapping
    contentTypes: {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'webp': 'image/webp',
        'gif': 'image/gif'
    },

    // S3 object settings
    objectSettings: {
        ACL: 'public-read', // ACL for public read access (adjust based on your needs)
        CacheControl: 'max-age=31536000', // Cache control for 1 year
        ServerSideEncryption: 'AES256' // Metadata

    },

    // Presigned URL settings
    presignedUrl: {
        expiresIn: 3600, // 1 hour
        conditions: [
            ['content-length-range', 0, envConfig.MAX_FILE_SIZE],
            ['starts-with', '$Content-Type', 'image/']
        ]
    },

    // Multipart upload settings
    multipartUpload: {
        partSize: 5 * 1024 * 1024, // 5MB
        queueSize: 4
    }
})

// Helper: Test S3 bucket access
async function testS3Connection() {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }))
        logger.info(`S3 connection established successfully to bucket: ${bucketName}`)
        return true
    } catch (error) {
        logger.error(`S3 connection failed: ${error.message}`)
        if (error.name === 'NotFound') {
            logger.error(`Bucket ${bucketName} does not exist`)
        } else if (error.name === 'Forbidden') {
            logger.error(`Access denied to bucket ${bucketName}`)
        }
        return false
    }
}

// Enhanced S3 configuration with helper methods
const enhancedS3 = Object.freeze({
    ...s3Config,

    // Helper methods
    helpers: {
        testS3Connection,

        generateKey: (folder, filename, userId = null) => {
            const timestamp = Date.now()
            const userPrefix = userId ? `user-${userId}/` : ''
            return `${folder}/${userPrefix}${timestamp}-${filename}`
        }, // Generate S3 object key

        getPublicUrl: key => `https://${bucketName}.s3.${region}.amazonaws.com/${key}`, // Get public URL for S3 object

        getContentType: filename => {
            if (!filename || typeof filename !== 'string') return 'application/octet-stream'
            const ext = filename.split('.').pop()?.toLowerCase()
            return s3Config.contentTypes[ext] || 'application/octet-stream'
        }, // Get content type from file extension

        isValidFileType: type =>
            Object.values(s3Config.contentTypes).includes(type), // Validate file type

        getUploadParams: (Key, Body, ContentType, Metadata = {}) => ({
            Bucket: bucketName,
            Key, Body, ContentType,
            ...s3Config.objectSettings,
            Metadata: { uploadedAt: new Date().toISOString(), ...Metadata }
        }) // Generate upload parameters
    }
})

// Auto-test S3 at startup (except in tests)
if (envConfig.NODE_ENV !== 'test') {
    testS3Connection().catch(err => {
        logger.warn('S3 connection test failed at startup. Continuing...')
    })
}

module.exports = { s3Config: enhancedS3 }