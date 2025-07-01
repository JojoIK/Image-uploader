const { HTTPSTATUS } = require("../config/httpConfig.js");
const { ErrorCodeEnum } = require("./errorCodeEnum.js");
const logger = require("./logger");

// Format Zod validation errors into a structured API response
const formatZodError = (res, error) => {
  if (error?.issues || !Array.isArray(error.issues)) {
    logger.error('Invalid Zod error object', { error })

    return res.status(HTTPSTATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation failed',
      errorCode: ErrorCodeEnum.VALIDATION_ERROR,
      errors: []
    })
  }


  const errors = error.issues.map(issue => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message
  }))

  logger.warn(
    'Zod validation failed on fields: %s | Total issues: %d',
    errors.map(e => e.field).join(', '),
    errors.length
  )

  const response = {
    success: false,
    message: 'Validation failed',
    errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    errors
  }

  if (process.env.NODE_ENV === 'development') {
    response.debug = { fullError: error }
  }

  return res.status(HTTPSTATUS.BAD_REQUEST).json(response);
}

module.exports = formatZodError