const express = require("express");
const authController = require("../controllers/authController");
const { authenticateUser } = require("../../middlewares/authentication");
const { authRateLimit } = require("../../middlewares/rateLimiter");
const { validateUserLogin, validateUserRegistration } = require("../../middlewares/zodValidation");
const router = express.Router()

// Register a new user
router.post('/register', authRateLimit, validateUserRegistration, authController.register)

// Log in an existing user and issue JWT
router.post('/login', authRateLimit, validateUserLogin, authController.login)

// Log out current user (clears JWT cookie)
router.post('/logout', authenticateUser, authController.logout)

// Get authenticated user profile
router.get('/me', authenticateUser, authController.me)


module.exports = router

