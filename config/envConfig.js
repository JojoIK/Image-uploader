require("dotenv").config();
const { z } = require('zod');
const logger = require('../utils/logger');

// Environment variables schema
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),

    //Database
    DATABASE_URL: z.string().min(1, 'Database URL is required'),

    //AWS S3 CONFIGURATION
    AWS_REGION: z.string().min(1, 'AWS region is required'),
    AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS access key is required'),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS secret key is required'),
    S3_BUCKET_NAME: z.string().min(1, 'S3 bucket name is required'),
    S3_BUCKET_REGION: z.string().optional(),

    //JWT Configuration
    JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().dafault('7d'),

    //Upload Configuration
    MAX_FILE_SIZE: z.string().transform(v => {
        // Allow both byte string (e.g. '10485760') or '10MB' style
        const mbMatch = v.match(/^(\d+)(mb)?$/i);
        return mbMatch ? parseInt(mbMatch[1]) * (mbMatch[2] ? 1024 * 1024 : 1) : parseInt(v);
    }).default('10485760'), // 10MB default,
    MAX_FILES: z.string().transform(Number).default('5'),
    ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp,image/gif'),
    ALLOWED_EXTENSIONS: z.string().default('jpg,jpeg,png,gif,webp'),

    //Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

    //Storage Configuration
    STORAGE_TYPE: z.enum(['local', 's3']).default('s3'),
    LOCAL_UPLOAD_PATH: z.string().default('./uploads'),

    //CORS
    ALLOWED_ORIGINS: z.string().optional(),

    //Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
})

//Validate environment variables
let envConfig
try {
    envConfig = envSchema.parse(process.env)
} catch (error) {
    logger.error('Invalid environment configuration')
    logger.error(error.errors.map(err => ` ${err.path.join('.')}: ${err.message}`).join('\n'))
    process.exit(1)
}

//Derived configurations
const config = {
    ...envConfig,

    // Parse file types/extensions
    allowedFileTypes: envConfig.ALLOWED_FILE_TYPES.split(','),
    allowedExtensions: envConfig.ALLOWED_EXTENSIONS.split(','),

    // Parse allowed origins
    allowedOrigins: envConfig.ALLOWED_ORIGINS ? envConfig.ALLOWED_ORIGINS.split(',') : null,

    // Image processing settings
    imageProcessing: {
        thumbnail: { width: 150, height: 150, quality: 80 },
        medium: { width: 800, height: 600, quality: 85 },
        large: { width: 1920, height: 1080, quality: 90 }
    },

    // S3 configuration
    s3: {
        region: envConfig.AWS_REGION,
        credentials: {
            accessKeyId: envConfig.AWS_ACCESS_KEY_ID,
            secretAccessKey: envConfig.AWS_SECRET_ACCESS_KEY
        },
        bucketName: envConfig.S3_BUCKET_NAME,
        bucketRegion: envConfig.S3_BUCKET_REGION || envConfig.AWS_REGION
    }
}

module.exports = { envConfig: config }