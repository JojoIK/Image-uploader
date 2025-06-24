const formatZodError = require("../utils/format-zodErrors");
const { HTTP_STATUS } = require("../config/httpConfig");
const logger = require("../utils/logger");
const { AppError } = require("../utils/appError");
const { envConfig } = require("../config/envConfig");

// Express error-handling middleware 
const errorHandler = (err, req, res, next) => {
    const error = err instanceof Error ? err : new Error(String(err))
    const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR

    logger.error('Unhandled Error', {
        name: error.name,
        message: error.message,
        stack: envConfig.NODE_ENV === 'development' ? error.stack : undefined,
        path: req.path,
        method: req.method
    })

    // Handle Zod validation error
    if (error.name === 'ZodError') {
        return formatZodError(req, error)
    }

    // Handle custom AppError instances
    if (error instanceof AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: error.message,
            errorCode: error.errorCode || 'UNSPECIFIED_APP_ERROR'
        })
    }

    // Fallback: generic internal server error
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Something went wrong',
        errorCode: 'UNEXPECTED_ERROR'
    })
}


module.exports = errorHandler