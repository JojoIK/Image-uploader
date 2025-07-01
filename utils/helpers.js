const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');

// Generate a unique filename to prevent collisions

const generateUniqueFilename = (originalName, prefix = '') => {
  const timestamp = Date.now()
  const uuid = uuidv4()
  const extension = path.extname(originalName).toLowerCase()
  const baseName = path.basename(originalName, extension)

  // Sanitize the base name
  const sanitizedBaseName = baseName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 50) // Limit length

  // Create unique filename
  const uniqueFilename = prefix
    ? `${prefix}_${sanitizedBaseName}_${timestamp}_${uuid.slice(0, 8)}${extension}`
    : `${sanitizedBaseName}_${timestamp}_${uuid.slice(0, 8)}${extension}`

  return uniqueFilename
}

// Generate a secure random string
const generateSecureToken = (length = 32) => crypto.randomBytes(length).toString('hex')

// Format file size in human readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return bytes < 1024
    ? `${bytes} Bytes`
    : parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Get image dimensions from Sharp metadata
const getImageDimensions = (metadata) => {
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    aspectRatio: metadata.width && metadata.height
      ? (metadata.width / metadata.height).toFixed(2)
      : null
  }
}

// Validate image dimensions
const validateImageDimensions = (dimensions, constraints = {}) => {
  const {
    minWidth = 0,
    maxWidth = Infinity,
    minHeight = 0,
    maxHeight = Infinity,
    aspectRatioMin = 0,
    aspectRatioMax = Infinity
  } = constraints

  const errors = []

  if (dimensions.width < minWidth) {
    errors.push(`Width must be at least ${minWidth}px`)
  }

  if (dimensions.width > maxWidth) {
    errors.push(`Width must not exceed ${maxWidth}px`)
  }

  if (dimensions.height < minHeight) {
    errors.push(`Height must be at least ${minHeight}px`)
  }

  if (dimensions.height > maxHeight) {
    errors.push(`Height must not exceed ${maxHeight}px`)
  }

  const aspectRatio = parseFloat(dimensions.aspectRatio)
  if (aspectRatio < aspectRatioMin) {
    errors.push(`Aspect ratio must be at least ${aspectRatioMin}`)
  }

  if (aspectRatio > aspectRatioMax) {
    errors.push(`Aspect ratio must not exceed ${aspectRatioMax}`)
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// Create a standardized API response
const createResponse = (success, message, data = null, error = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString()
  }

  if (data !== null) {
    response.data = data
  }

  if (error !== null) {
    response.error = error
  }

  return response
}

// Sanitize filename for safe storage
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_') // Replace invalid characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .trim()
}

// Extract metadata from file buffer
const extractBasicMetadata = (buffer, mimetype) => {
  return {
    size: buffer.length,
    mimetype,
    hash: crypto.createHash('md5').update(buffer).digest('hex'),
    uploadDate: new Date().toISOString()
  }
}

// Generate thumbnail filename based on original filename
const generateThumbnailFilename = (originalFilename, size) => {
  const parsed = path.parse(originalFilename);
  return `${parsed.name}_thumb_${size}${parsed.ext}`
}

// Check if file type is supported
const isSupportedFileType = (mimetype, allowedTypes = []) => {
  const defaultAllowedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/tiff',
    'image/svg+xml'
  ]

  const typesToCheck = allowedTypes.length > 0 ? allowedTypes : defaultAllowedTypes
  return typesToCheck.includes((mimetype || '').toLowerCase())
}

// Create pagination metadata
const createPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit)
  const hasNext = page < totalPages
  const hasPrev = page > 1

  return {
    currentPage: page,
    itemsPerPage: limit,
    totalItems: total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null
  }
}

// Sleep for specified milliseconds (useful for testing)

const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  generateUniqueFilename,
  generateSecureToken,
  formatFileSize,
  getImageDimensions,
  validateImageDimensions,
  createResponse,
  sanitizeFilename,
  extractBasicMetadata,
  generateThumbnailFilename,
  isSupportedFileType,
  createPaginationMeta,
  sleep
}