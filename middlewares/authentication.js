const jwt = require("jsonwebtoken");
const { UnauthorizedException, ForbiddenException } = require("../utils/appError");
const { envConfig } = require("../config/envConfig");
const { dbConfig } = require("../config/dbConfig");


// Authentication middleware
const authenticateUser = async (req, res, next) => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new UnauthorizedException('No token provided'))
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, envConfig.JWT_SECRET)

        // Get user from database
        const user = await dbConfig.client.user.findUnique({
            where: { id: decoded.id },
            select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                lastName: true,
                role: true,
                isActive: true,
                createdAt: true
            }
        })

        if (!user || !user.isActive) {
            return next(new ForbiddenException('User is not active or does not exist'))
        }

        // Add user to request object
        req.user = { id: user.id, role: user.role.toUpperCase() }
        return next()
    } catch (err) {
        return next(new UnauthorizedException('Invalid or expired token'))
    }
}

//Role-based access control middleware
const authorizeRoles = (...roles) => (req, res, next) => {
    if (!req.user) return next(new UnauthorizedException('Authentication required'))

    const userRole = req.user.role.toUpperCase()
    const allowed = roles.map(r => r.toUpperCase())
    if (!allowed.includes(userRole)) return next(new ForbiddenException('Access denied'))
    return next()
}

// Resource ownership enforcement
const requireOwnership = (options = {}) => async (req, res, next) => {
    const { param = 'id', type = 'image' } = options

    if (!req.user) return next(new UnauthorizedException())

    const resourceId = req.params[param]
    if (!resourceId) return next(new ForbiddenException('Missing resource ID'))

    let resource
    switch (type) {
        case 'value':
            resource = await dbConfig.client.image.findUnique({
                where: { id: resourceId },
                select: { userId: true }
            })
            break
        case 'user':
            resource = await dbConfig.client.user.findUnique({
                where: { id: resourceId },
                select: { id: true }
            })
            break
        default:
            return next(new ForbiddenException('Invalid resource type'))
    }

    if (!resource) return next(new ForbiddenException(`${type} not found`))

    const ownerId = resource.userId ?? resource.id
    if (ownerId !== req.user.id && req.user.role !== 'ADMIN') {
        return next(new ForbiddenException('Not authorized to access this resource'))
    }

    return next()
}

// In-memory user rate limiting (non-persistent)
const createUserRateLimit = (
    maxRequests = envConfig.RATE_LIMIT_MAX_REQUESTS,
    windowMs = envConfig.RATE_LIMIT_WINDOW_MS) => {
    const userMap = new Map()

    return (req, res, next) => {
        const key = req.user?.id || req.ip
        const now = Date.now()
        const times = userMap.get(key) || []
        const windowStart = now - windowMs
        const recent = times.filter(t => t >= windowStart)

        if (recent.length >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests',
                error: 'RATE_LIMIT_EXCEEDED'
            })
        }

        recent.push(now)
        userMap.set(key, recent)
        next()
    }
}


module.exports = {
    authenticateUser,
    authorizeRoles,
    requireOwnership,
    createUserRateLimit
}
