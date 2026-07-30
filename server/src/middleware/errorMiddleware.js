const { error } = require('../utils/response');

/**
 * notFound — 404 handler. Mount AFTER all routes.
 */
const notFound = (req, res) => {
  error(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

/**
 * errorHandler — centralised error handler. Mount LAST.
 * Handles: Mongoose validation errors, CastErrors, duplicate keys,
 * Multer errors, and generic 500s.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(`[errorHandler] ${err.message}`, err.stack ? '\n' + err.stack : '');

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field:   e.path,
      message: e.message,
    }));
    return error(res, 'Validation failed', 400, errors);
  }

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return error(res, `Invalid value for field: ${err.path}`, 400);
  }

  // MongoDB duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return error(res, `${field} already exists`, 409);
  }

  // Multer file size / type error
  if (err.name === 'MulterError') {
    return error(res, `File upload error: ${err.message}`, 400);
  }

  // JWT errors (shouldn't reach here normally, but just in case)
  if (err.name === 'JsonWebTokenError') return error(res, 'Invalid token', 401);
  if (err.name === 'TokenExpiredError') return error(res, 'Token expired', 401);

  // Operational errors that have a statusCode set
  if (err.statusCode) return error(res, err.message, err.statusCode);

  // Generic 500
  error(res, err.message || 'Internal server error', 500);
};

module.exports = { notFound, errorHandler };
