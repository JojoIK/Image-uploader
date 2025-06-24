const { HTTPSTATUS } = require("../config/httpConfig.js");
const { ErrorCodeEnum } = require("./errorCodeEnum.js");
const logger = require("./logger");

const formatZodError = (res, error) => {
  const errors = error?.issues?.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message
  }))

  // Log warning with field names and count
  logger.warn(
    'Zod validation failed on fields: %s | Total issues: %d',
    errors.map(e => e.field).join(', '),
    errors.length
  )

  return res.status(HTTPSTATUS.BAD_REQUEST).json({
    success: false,
    message: 'Validation failed',
    errorCode: ErrorCodeEnum.VALIDATION_ERROR,
    errors
  })
}

module.exports = formatZodError