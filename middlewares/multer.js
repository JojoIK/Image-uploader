const multer = require("multer");
const { s3Config } = require("../config/s3Config");
const { BadRequestException } = require("../utils/appError");
const { envConfig } = require("../config/envConfig");

// Memory storage for processing before uploading to S3
const storage = multer.memoryStorage()

// File filter function
const fileFilter = (req, file, cb) => {
    //Check if file type is allowed
    if (!s3Config.helpers.isValidFileType(file.mimetype)) {
        return cb(new BadRequestException('Unsupported file type'), false)
    }
    cb(null, true)
}

// Limits configuration
const limits = {
    fileSize: envConfig.MAX_FILE_SIZE,
}

const singleUpload = multer({ storage, fileFilter, limits }).single('image')

const multipleUpload = multer({ storage, fileFilter, limits }).array('images', envConfig.MAX_FILES)

const handleMulterError = (err, req, res, next) => {
    if (!err) return next()
    if (err instanceof multer.MulterError) {
        const message = {
            LIMIT_FILE_SIZE: `Max file size is ${envConfig.MAX_FILE_SIZE}`,
            LIMIT_UNEXPECTED_FILE: 'Unexpected field in form data'
        }[err.code] || err.message
        return res.status(400).json({ success: false, message, error: err.code })
    }
    return next(err)
}


module.exports = {
    singleUpload,
    multipleUpload,
    handleMulterError
}