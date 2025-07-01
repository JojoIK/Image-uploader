const express = require("express");
const { z } = require("zod");
const uploadController = require("../controllers/uploadController");
const {
    singleUpload,
    multipleUpload,
    handleMulterError
} = require("../../middlewares/multer");
const {
    uploadRateLimit,
    processingRateLimit,
} = require("../../middlewares/rateLimiter");
const {
    validateImageUpload,
    validateImageProcessing,
    validateParams,
    schemas
} = require("../../middlewares/zodValidation");
const {
    authenticateUser,
    requireOwnership,
} = require("../../middlewares/authentication");
const router = express.Router();

// Upload single image
router.post(
    '/images/upload',
    authenticateUser,
    uploadRateLimit,
    singleUpload,
    handleMulterError,
    validateImageUpload,
    uploadController.uploadImage
)

// Upload multiple images
router.post(
    '/images/upload/multiple',
    authenticateUser,
    uploadRateLimit,
    multipleUpload,
    handleMulterError,
    uploadController.uploadMultiple
)

// Get image by ID 
router.get(
    '/images/:id',
    authenticateUser,
    validateParams(z.object({ id: schemas.common.uuid })),
    requireOwnership,
    uploadController.getImageById
)

// Get authenticated user images with pagination
router.get(
    '/images',
    authenticateUser,
    uploadController.getUserImages
)

// Delete image by ID
router.delete(
    '/images/:id',
    authenticateUser,
    requireOwnership,
    uploadController.deleteImage
)

// Transform image (eg resize, format)
router.get(
    '/images/:id/transformed',
    authenticateUser,
    requireOwnership,
    validateImageProcessing,
    processingRateLimit,
    uploadController.transformImage
)

// Get Image analytics/stats
router.get(
    '/images/stats',
    authenticateUser,
    processingRateLimit,
    uploadController.getImageStats
)


module.exports = router 