const { S3Client, ServerSideEncryption } = require("@aws-sdk/client-s3");
const { envConfig } = require("./envConfig");
const winston = require('winston')

// Configure logger for S3 operations
const s3Logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/s3.log' })
    ]
})

// Initialize S3 Client
const s3Client = new S3Client({
    region: envConfig.s3.region,
    credentials: envConfig.s3.credentials,
    requestHandler: {
        requestTimeout: 30000, //30 seconds
        httpsAgent: {
            maxSockets: 25
        }
    }
})

// S3 Configuration object
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
    // ACL for public read access (adjust based on your needs)
    ACL: 'public-read',
    
    // Cache control
    CacheControl: 'max-age=31536000', // 1 year
    
    // Metadata
    ServerSideEncryption: 'AES256'
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
const testS3Connection = async () => {
  try {
    const { HeadBucketCommand } = require('@aws-sdk/client-s3')
    await s3Client.send(new HeadBucketCommand({
      Bucket: s3Config.bucketName
    }))
    s3Logger.info(`S3 connection established successfully to bucket: ${s3Config.bucketName}`)
    return true
  } catch (error) {
    s3Logger.error('S3 connection failed: ', error.message)
    if (error.name === 'NotFound') {
      s3Logger.error(`Bucket ${s3Config.bucketName} does not exist`)
    } else if (error.name === 'Forbidden') {
      s3Logger.error(`Access denied to bucket ${s3Config.bucketName}`)
    }
    return false
  }
}

// Generate S3 object key
const generateS3Key = (folder, filename, userId = null) => {
  const timestamp = Date.now()
  const userPrefix = userId ? `user-${userId}/` : ''
  return `${folder}/${userPrefix}${timestamp}-${filename}`
}

// Get public URL for S3 object
const getPublicUrl = (key) => {
  return `https://${s3Config.bucketName}.s3.${s3Config.region}.amazonaws.com/${key}`
}

// Enhanced S3 configuration with helper methods
const enhancedS3Config = {
  ...s3Config,
  
  // Helper methods
  helpers: {
    generateKey: generateS3Key,
    getPublicUrl,
    testConnection: testS3Connection,
    
    // Get content type from file extension
    getContentType: (filename) => {
      const ext = filename.split('.').pop().toLowerCase()
      return s3Config.contentTypes[ext] || 'application/octet-stream'
    },
    
    // Validate file type
    isValidFileType: (contentType) => {
      return Object.values(s3Config.contentTypes).includes(contentType)
    },
    
    // Generate upload parameters
    getUploadParams: (key, buffer, contentType, metadata = {}) => ({
      Bucket: s3Config.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ...s3Config.objectSettings,
      Metadata: {
        uploadedAt: new Date().toISOString(),
        ...metadata
      }
    })
  }
}

// Test connection on initialization
if (process.env.NODE_ENV !== 'test') {
    testS3Connection()
}
module.exports = {s3Config: enhancedS3Config}