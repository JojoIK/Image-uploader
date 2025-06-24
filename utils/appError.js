const { HTTPSTATUS } = require("../config/httpConfig.js");
const { ErrorCodeEnum } = require("./errorCodeEnum.js");

class AppError extends Error {
    constructor(
        message,
        statusCode = HTTPSTATUS.INTERNAL_SERVER_ERROR,
        errorCode = ErrorCodeEnum.INTERNAL_SERVER_ERROR
    ) {
        super(message)
        this.statusCode = statusCode
        this.errorCode = errorCode
        Error.captureStackTrace(this, this.constructor)
    }
}

class HttpException extends AppError {
    constructor(message = 'Http Exception Error', statusCode, errorCode) {
        super(message, statusCode, errorCode)
    }
}

class InternalServerException extends AppError {
    constructor(message = 'Internal Server Error', errorCode = ErrorCodeEnum.INTERNAL_SERVER_ERROR) {
        super(message, HTTPSTATUS.INTERNAL_SERVER_ERROR, errorCode)
    }
}

class NotFoundException extends AppError {
    constructor(message = 'Resource not found', errorCode = ErrorCodeEnum.RESOURCE_NOT_FOUND) {
        super(message, HTTPSTATUS.NOT_FOUND, errorCode)
    }
}

class BadRequestException extends AppError {
    constructor(message = 'Bad Request', errorCode = ErrorCodeEnum.VALIDATION_ERROR) {
        super(message, HTTPSTATUS.BAD_REQUEST, errorCode)
    }
}

class UnauthorizedException extends AppError {
    constructor(message = 'Unauthorized Access', errorCode = ErrorCodeEnum.ACCESS_UNAUTHORIZED) {
        super(message, HTTPSTATUS.UNAUTHORIZED, errorCode)
    }
}

class ForbiddenException extends AppError {
    constructor(message = 'Forbidden Access', errorCode = ErrorCodeEnum.ACCESS_FORBIDDEN) {
        super(message, HTTPSTATUS.FORBIDDEN, errorCode)
    }
}

module.exports = {
    AppError,
    HttpException,
    InternalServerException,
    NotFoundException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException
}