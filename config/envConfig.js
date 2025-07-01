require("dotenv").config();
const { z, ZodError } = require('zod');

// Environment variables schema
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(3000),

    //Database
    DATABASE_URL: z.string().min(1, 'Database URL is required'),
    DB_LOG_QUERY: z.coerce.boolean().default(true),
    DB_LOG_INFO: z.coerce.boolean().default(true),

    //AWS S3 
    AWS_REGION: z.string().min(1, 'AWS region is required'),
    AWS_ACCESS_KEY_ID: z.string().min(1, 'AWS access key is required'),
    AWS_SECRET_ACCESS_KEY: z.string().min(1, 'AWS secret key is required'),
    S3_BUCKET_NAME: z.string().min(1, 'S3 bucket name is required'),
    S3_BUCKET_REGION: z.string().optional(),

    //JWT 
    JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().default(12),

    //Swagger
    ENABLE_SWAGGER_IN_PROD: z.coerce.boolean().default(false),

    //Upload Configuration
    MAX_FILE_SIZE: z.preprocess(
        (val) => {
            if (typeof val === 'number') return val
            const str = String(val)
            const match = str.match(/^(\d+)(mb)?$/i)
            return match ? parseInt(match[1]) * (match[2] ? 1024 * 1024 : 1) : parseInt(str)
        },
        z.number().default('10485760') // 10MB default
    ),
    MAX_FILES: z.coerce.number().default('5'),
    ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/webp,image/gif'),
    ALLOWED_EXTENSIONS: z.string().default('jpg,jpeg,png,gif,webp'),

    //Rate Limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default('900000'), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default('100'),
    UPLOAD_RATE_LIMIT: z.coerce.number().default(10),

    //Storage Configuration
    STORAGE_TYPE: z.enum(['local', 's3']).default('s3'),
    LOCAL_UPLOAD_PATH: z.string().default('./uploads'),

    //CORS
    ALLOWED_ORIGINS: z.string().optional(),

    //Logging
    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
})

//Validate and parse environment variables
let parsedEnv
try {
    parsedEnv = envSchema.parse(process.env)
} catch (error) {
    console.error('Invalid environment configuration')

    if (error instanceof ZodError) {
        error.errors.forEach(err => {
            console.error(` ${err.path.join('.')}: ${err.message}`)
        })
    } else {
        console.error(error)
    }
    process.exit(1)
}

//Derived configurations
const config = Object.freeze({
    ...parsedEnv,

    // Parse file types/extensions
    allowedFileTypes: parsedEnv.ALLOWED_FILE_TYPES.split(','),
    allowedExtensions: parsedEnv.ALLOWED_EXTENSIONS.split(','),

    // Parse allowed origins
    allowedOrigins: parsedEnv.ALLOWED_ORIGINS
        ? parsedEnv.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
        : [],

    // Image processing settings
    imageProcessing: {
        thumbnail: { width: 150, height: 150, quality: 80 },
        medium: { width: 800, height: 600, quality: 85 },
        large: { width: 1920, height: 1080, quality: 90 }
    },

    // S3 configuration
    s3: {
        region: parsedEnv.AWS_REGION,
        credentials: {
            accessKeyId: parsedEnv.AWS_ACCESS_KEY_ID,
            secretAccessKey: parsedEnv.AWS_SECRET_ACCESS_KEY
        },
        bucketName: parsedEnv.S3_BUCKET_NAME,
        bucketRegion: parsedEnv.S3_BUCKET_REGION || parsedEnv.AWS_REGION
    }
})

module.exports = { envConfig: config }
