/**
 * Error Handler Middleware - The Compassionate Guardian
 * 
 * Transforms chaos into clarity, converting errors into meaningful
 * responses while maintaining system stability and user trust.
 */

const logger = require('../utils/logger');
const config = require('../config/environment');

class ErrorTransformer {
  /**
   * Main error handling middleware
   * Transforms all errors into appropriate HTTP responses
   */
  static handle(error, req, res, next) {
    const errorContext = {
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.id || 'unknown'
    };

    // Log the error with full context
    logger.error('Request error occurred', {
      error: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status || error.statusCode,
      ...errorContext
    });

    // Transform error into response
    const errorResponse = ErrorTransformer.transformError(error);
    
    // Add request context in development
    if (config.isDevelopment()) {
      errorResponse.debug = {
        stack: error.stack,
        ...errorContext
      };
    }

    res.status(errorResponse.status).json(errorResponse);
  }

  /**
   * Transform error into standardized response format
   */
  static transformError(error) {
    // Validation errors - gentle guidance
    if (error.name === 'ValidationError') {
      return {
        status: 400,
        error: 'Validation Error',
        message: 'The information provided needs adjustment',
        details: ErrorTransformer.extractValidationDetails(error),
        timestamp: new Date().toISOString(),
        type: 'validation_error'
      };
    }

    // Authentication errors - respectful denial
    if (error.name === 'UnauthorizedError' || error.status === 401) {
      return {
        status: 401,
        error: 'Authentication Required',
        message: 'Please authenticate to access this resource',
        timestamp: new Date().toISOString(),
        type: 'auth_error'
      };
    }

    // Authorization errors - clear boundaries
    if (error.status === 403) {
      return {
        status: 403,
        error: 'Access Forbidden',
        message: 'You do not have permission to access this resource',
        timestamp: new Date().toISOString(),
        type: 'authorization_error'
      };
    }

    // Not found errors - helpful redirection
    if (error.status === 404) {
      return {
        status: 404,
        error: 'Resource Not Found',
        message: 'The resource you seek does not exist in this realm',
        timestamp: new Date().toISOString(),
        type: 'not_found_error'
      };
    }

    // Rate limiting errors - gentle boundaries
    if (error.status === 429) {
      return {
        status: 429,
        error: 'Too Many Requests',
        message: 'Please slow down and try again in a moment',
        retryAfter: error.retryAfter || 60,
        timestamp: new Date().toISOString(),
        type: 'rate_limit_error'
      };
    }

    // Database errors - system wisdom
    if (ErrorTransformer.isDatabaseError(error)) {
      return {
        status: 500,
        error: 'Database Connection Issue',
        message: 'The system is temporarily unable to process your request',
        timestamp: new Date().toISOString(),
        type: 'database_error'
      };
    }

    // Network errors - connection awareness
    if (ErrorTransformer.isNetworkError(error)) {
      return {
        status: 503,
        error: 'Service Temporarily Unavailable',
        message: 'External services are currently unavailable',
        timestamp: new Date().toISOString(),
        type: 'network_error'
      };
    }

    // File system errors
    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      return {
        status: 500,
        error: 'File System Error',
        message: 'Unable to access required system resources',
        timestamp: new Date().toISOString(),
        type: 'filesystem_error'
      };
    }

    // Default error response - universal compassion
    return {
      status: error.status || error.statusCode || 500,
      error: 'Internal Server Error',
      message: config.isDevelopment() ? 
        error.message : 
        'An unexpected situation has arisen. Our team has been notified.',
      timestamp: new Date().toISOString(),
      type: 'internal_error'
    };
  }

  /**
   * Extract meaningful validation details
   */
  static extractValidationDetails(error) {
    if (error.errors) {
      return Object.keys(error.errors).map(field => ({
        field,
        message: error.errors[field].message,
        value: error.errors[field].value
      }));
    }

    if (error.details && Array.isArray(error.details)) {
      return error.details.map(detail => ({
        field: detail.path ? detail.path.join('.') : 'unknown',
        message: detail.message,
        value: detail.context?.value
      }));
    }

    return [{ message: error.message }];
  }

  /**
   * Detect database-related errors
   */
  static isDatabaseError(error) {
    const dbErrors = [
      'MongoError', 'MongooseError', 'MongoNetworkError',
      'MongoTimeoutError', 'RedisError', 'ConnectionError'
    ];

    return dbErrors.some(errorType => 
      error.name?.includes(errorType) || 
      error.constructor?.name?.includes(errorType)
    );
  }

  /**
   * Detect network-related errors
   */
  static isNetworkError(error) {
    const networkCodes = [
      'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 
      'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH'
    ];

    return networkCodes.includes(error.code) ||
           error.message?.includes('network') ||
           error.message?.includes('timeout');
  }

  /**
   * Async error wrapper for route handlers
   * Catches async errors and passes them to error middleware
   */
  static asyncCatch(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create custom application errors
   */
  static createError(message, status = 500, type = 'application_error') {
    const error = new Error(message);
    error.status = status;
    error.type = type;
    return error;
  }

  /**
   * Validation error creator
   */
  static validationError(message, field = null, value = null) {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.status = 400;
    error.field = field;
    error.value = value;
    return error;
  }

  /**
   * Authentication error creator
   */
  static authenticationError(message = 'Authentication required') {
    const error = new Error(message);
    error.name = 'UnauthorizedError';
    error.status = 401;
    return error;
  }

  /**
   * Authorization error creator
   */
  static authorizationError(message = 'Access forbidden') {
    const error = new Error(message);
    error.status = 403;
    return error;
  }

  /**
   * Not found error creator
   */
  static notFoundError(message = 'Resource not found', resource = null) {
    const error = new Error(message);
    error.status = 404;
    error.resource = resource;
    return error;
  }
}

module.exports = ErrorTransformer.handle;
module.exports.ErrorTransformer = ErrorTransformer;