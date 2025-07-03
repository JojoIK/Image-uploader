const { prisma } = require("../../config/dbConfig");
const { envConfig } = require("../../config/envConfig")
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createResponse } = require("../../utils/helpers");
const { HTTP_STATUS } = require("../../config/httpConfig");
const logger = require("../../utils/logger");

// Environment variables for JWT
const JWT_SECRET = envConfig.JWT_SECRET || 'your_jwt_secret'
const JWT_EXPIRES_IN = envConfig.JWT_EXPIRES_IN || '7d'

// Register a new user
class AuthController {
    async register(req, res) {
        try {
            const { email, username, password, firstName, lastName } = req.body

            // Validate required fields
            if (!email || !password) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json(
                    createResponse(false, "Email and password are required", null, 'MISSING_CREDENTIALS')
                )
            }

            // Check if user already exists by email or username
            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [{ email }]
                }
            })

            if (existingUser) {
                return res.status(HTTP_STATUS.CONFLICT).json(
                    createResponse(false, "User already exists", null, "DUPLICATE_USER")
                )
            }

            // Hash the password before saving
            const hashedPassword = await bcrypt.hash(password, envConfig.BCRYPT_SALT_ROUNDS)

            // Create new user in the database
            const user = await prisma.user.create({
                data: {
                    email,
                    username,
                    password: hashedPassword,
                    firstName,
                    lastName
                }
            })

            return res.status(HTTP_STATUS.CREATED).json(
                createResponse(true, 'User registered successfuly', {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                })
            )
        } catch (error) {
            logger.logError(error, { operation: "REGISTER_USER" })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Registration failed', null, error.message)
            )
        }
    }

    // Login an existing user
    async login(req, res) {
        try {
            const { email, password } = req.body

            // Validate required inputs
            if (!email || !password) {
                return res.status(HTTP_STATUS.BAD_REQUEST).json(
                    createResponse(false, 'Email and password are required', null, 'MISSING_CREDENTIALS')
                )
            }

            // Find user by email
            const user = await prisma.user.findUnique({ where: { email } })

            if (!user || !(await bcrypt.compare(password, user.password))) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json(
                    createResponse(false, 'Invalid credentials', null, 'INVALID_CREDENTIALS')
                )
            }

            // Generate JWT token
            const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
                expiresIn: JWT_EXPIRES_IN
            })

            // Set token as HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: envConfig.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            })

            return res.status(HTTP_STATUS.OK).json(
                createResponse(true, 'Login successful', {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role,
                    token
                })
            )
        } catch (error) {
            logger.logError(error, { operation: "LOGIN_USER" })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Login failed', null, error.message)
            )
        }
    }

    //Logout a user
    async logout(req, res) {
        res.clearCookie('token')
        return res
            .status(HTTP_STATUS.OK)
            .json(createResponse(true, 'Logged out successfully'))
    }


    //Retrieve authenticated user info
    async me(req, res, next) {
        try {
            const userId = req.user?.id

            if (!userId) {
                return res.status(HTTP_STATUS.UNAUTHORIZED).json(
                    createResponse(false, 'User is not authenticated')
                )
            }

            // Fetch user info from DB with selected fields
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    id: true,
                    email: true,
                    username: true,
                    lastName: true,
                    role: true
                }
            })

            if (!user) {
                return res
                    .status(HTTP_STATUS.NOT_FOUND)
                    .json(createResponse(false, 'User not found'))
            }

            return res.status(HTTP_STATUS.OK).json(createResponse(true, 'User info retrieved', user))
        } catch (error) {
            logger.logError(error, { operation: 'GET_ME' })
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
                createResponse(false, 'Failed to retrieve user info', null, error.message)
            )
        }
    }
}

// Instantiate the controller
const authController = new AuthController()


module.exports = authController