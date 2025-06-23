require("dotenv").config();
const { S3Client, HeadBucketCommand } = require("@aws-sdk/client-s3");
const { envConfig } = require("./envConfig");
const logger = require('../utils/logger');


// Initialize S3 Client
const s3Client = new S3Client({
    region: envConfig.s3.region,
    credentials: envConfig.s3.credentials,
    requestHandler: {
        requestTimeout: 30000, //30 seconds
        httpsAgent: { maxSockets: 25 }
    }
})

// S3 shared config and helpers
const s3Config = {
    client: s3Client,
    bucketName: envConfig.s3.bucketName,
    region: envConfig.s3.region,

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
}

// Test S3 connection
async function testS3Connection() {
    try {
        await s3Client.send(new HeadBucketCommand({ Bucket: s3Config.bucketName }))
        logger.info(`S3 connection established successfully to bucket: ${s3Config.bucketName}`)
        return true
    } catch (error) {
        logger.error(`S3 connection failed: ${error.message}`)
        if (error.name === 'NotFound') {
            logger.error(`Bucket ${s3Config.bucketName} does not exist`)
        } else if (error.name === 'Forbidden') {
            logger.error(`Access denied to bucket ${s3Config.bucketName}`)
        }
        return false
    }
}

// Enhanced S3 configuration with helper methods
const enhancedS3 = {
    ...s3Config,

    // Helper methods
    helpers: {
        testS3Connection,
        generateKey: (folder, filename, userId = null) => {
            const timestamp = Date.now()
            const userPrefix = userId ? `user-${userId}/` : ''
            return `${folder}/${userPrefix}${timestamp}-${filename}`
        }, // Generate S3 object key
        getPublicUrl: key => `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`, // Get public URL for S3 object
        getContentType: (filename) => {
            const ext = filename.split('.').pop().toLowerCase()
            return s3Config.contentTypes[ext] || 'application/octet-stream'
        }, // Get content type from file extension
        isValidFileType: type => Object.values(s3Config.contentTypes).includes(type), // Validate file type
        getUploadParams: (Key, Body, ContentType, Metadata = {}) => ({
            Bucket: s3Config.bucketName,
            Key, Body, ContentType,
            ...s3Config.objectSettings,
            Metadata: { uploadedAt: new Date().toISOString(), ...Metadata }
        }) // Generate upload parameters
    }
}

// Auto-test S3 at startup (except in tests)
if (envConfig.NODE_ENV !== 'test') testS3Connection()

module.exports = { s3Config: enhancedS3 }