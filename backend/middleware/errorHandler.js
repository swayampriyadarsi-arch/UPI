/**
 * Centralized error handler.
 *
 * Returns JSON error responses so the frontend always receives structured data.
 * Stack traces are NEVER exposed in production.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const isDev = process.env.NODE_ENV !== 'production';

  // Mongoose duplicate key (e.g. duplicate packetHash — defense-in-depth idempotency)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'Duplicate record — this transaction was already processed',
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  // Mongoose cast error (bad ObjectId etc.)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid value for field: ${err.path}`,
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(isDev && err.stack ? { stack: err.stack } : {}),
  });
}

module.exports = errorHandler;
