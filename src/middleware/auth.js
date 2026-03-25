/**
 * Authentication Middleware - The Guardian of Trust
 * 
 * Validates identity with gentle firmness, protecting the sacred
 * spaces while welcoming the rightful souls.
 */

const jwt = require('jsonwebtoken');
const { User } = require('../models');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { ErrorTransformer } = require('./errorHandler');

class AuthGuardian {
  /**
   * Verify JWT token and extract user identity
   */
  static async verifyToken(req, res, next) {
    try {
      const token = AuthGuardian.extractToken(req);
      
      if (!token) {
        throw ErrorTransformer.authenticationError('Access token is required');
      }

      // Verify token with gentle precision
      const decoded = jwt.verify(token, config.security.jwtSecret);
      
      // Fetch full user data from database
      const user = await User.findById(decoded.userId)
        .select('-passwordHash -refreshTokens -emailVerificationToken -passwordResetToken')
        .lean();

      if (!user) {
        throw ErrorTransformer.authenticationError('User account no longer exists');
      }

      // Check account status
      if (user.status === 'suspended') {
        throw ErrorTransformer.authorizationError('Account suspended');
      }

      if (user.status === 'deactivated') {
        throw ErrorTransformer.authorizationError('Account deactivated');
      }

      // Attach user context to request
      req.user = {
        _id: user._id,
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        profile: user.profile,
        status: user.status,
        emailVerified: user.emailVerified,
        presence: user.presence,
        privacy: user.privacy,
        tokenType: decoded.type || 'access',
        issuedAt: new Date(decoded.iat * 1000),
        expiresAt: new Date(decoded.exp * 1000)
      };

      // Log successful authentication
      logger.debug('User authenticated successfully', {
        userId: req.user.id,
        username: req.user.username,
        email: req.user.email,
        status: req.user.status,
        path: req.path
      });

      next();
    } catch (error) {
      // Transform JWT errors into meaningful responses
      if (error.name === 'TokenExpiredError') {
        return next(ErrorTransformer.authenticationError('Access token has expired'));
      }

      if (error.name === 'JsonWebTokenError') {
        return next(ErrorTransformer.authenticationError('Invalid access token'));
      }

      if (error.name === 'NotBeforeError') {
        return next(ErrorTransformer.authenticationError('Access token not yet valid'));
      }

      // Pass through our custom auth errors
      if (error.status === 401 || error.status === 403) {
        return next(error);
      }

      // Log unexpected errors
      logger.error('Authentication error occurred', {
        error: error.message,
        stack: error.stack,
        userId: decoded?.userId
      });
      next(ErrorTransformer.authenticationError('Authentication failed'));
    }
  }

  /**
   * Optional authentication - allows both authenticated and anonymous users
   */
  static async optionalAuth(req, res, next) {
    try {
      const token = AuthGuardian.extractToken(req);
      
      if (!token) {
        req.user = null; // Anonymous user
        return next();
      }

      // Try to authenticate, but don't fail if token is invalid
      const decoded = jwt.verify(token, config.security.jwtSecret);
      req.user = {
        id: decoded.userId || decoded.id,
        email: decoded.email,
        role: decoded.role || 'user',
        permissions: decoded.permissions || []
      };

      next();
    } catch (error) {
      // Silent failure for optional auth
      req.user = null;
      next();
    }
  }

  /**
   * Role-based access control
   */
  static requireRole(roles) {
    // Normalize to array
    const requiredRoles = Array.isArray(roles) ? roles : [roles];

    return (req, res, next) => {
      if (!req.user) {
        return next(ErrorTransformer.authenticationError('Authentication required'));
      }

      const hasRequiredRole = requiredRoles.some(role => 
        req.user.role === role || req.user.role === 'admin'
      );

      if (!hasRequiredRole) {
        return next(ErrorTransformer.authorizationError(
          `Access denied. Required role: ${requiredRoles.join(' or ')}`
        ));
      }

      logger.debug('Role authorization successful', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles,
        path: req.path
      });

      next();
    };
  }

  /**
   * Permission-based access control
   */
  static requirePermission(permissions) {
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    return (req, res, next) => {
      if (!req.user) {
        return next(ErrorTransformer.authenticationError('Authentication required'));
      }

      // Admin role has all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        return next(ErrorTransformer.authorizationError(
          `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
        ));
      }

      logger.debug('Permission authorization successful', {
        userId: req.user.id,
        userPermissions,
        requiredPermissions,
        path: req.path
      });

      next();
    };
  }

  /**
   * Resource ownership validation
   */
  static requireOwnership(resourceIdParam = 'id', resourceUserField = 'userId') {
    return (req, res, next) => {
      if (!req.user) {
        return next(ErrorTransformer.authenticationError('Authentication required'));
      }

      // Admin can access any resource
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params[resourceIdParam];
      const resourceUserId = req.body[resourceUserField] || 
                           req.resource?.[resourceUserField];

      // Check if user owns the resource
      if (resourceUserId && resourceUserId !== req.user.id) {
        return next(ErrorTransformer.authorizationError(
          'Access denied. You can only access your own resources'
        ));
      }

      next();
    };
  }

  /**
   * Extract token from request headers or query parameters
   */
  static extractToken(req) {
    // Bearer token in Authorization header (preferred)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Token in query parameter (for WebSocket connections)
    if (req.query.token) {
      return req.query.token;
    }

    // Token in custom header
    if (req.headers['x-auth-token']) {
      return req.headers['x-auth-token'];
    }

    return null;
  }

  /**
   * Generate JWT token with user information
   */
  static generateToken(user, type = 'access', expiresIn = null) {
    const payload = {
      userId: user.id || user._id,
      email: user.email,
      role: user.role || 'user',
      permissions: user.permissions || [],
      type,
      iat: Math.floor(Date.now() / 1000)
    };

    const options = {
      expiresIn: expiresIn || config.security.jwtExpiresIn,
      issuer: 'viber-api',
      audience: 'viber-client'
    };

    return jwt.sign(payload, config.security.jwtSecret, options);
  }

  /**
   * Generate refresh token for token renewal
   */
  static generateRefreshToken(user) {
    return AuthGuardian.generateToken(user, 'refresh', '7d');
  }

  /**
   * Rate limiting for authentication attempts
   */
  static authRateLimit() {
    const attempts = new Map();
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_ATTEMPTS = 10;

    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      
      if (!attempts.has(key)) {
        attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return next();
      }

      const attempt = attempts.get(key);
      
      if (now > attempt.resetTime) {
        attempts.set(key, { count: 1, resetTime: now + WINDOW_MS });
        return next();
      }

      if (attempt.count >= MAX_ATTEMPTS) {
        const resetIn = Math.ceil((attempt.resetTime - now) / 1000);
        return next(ErrorTransformer.createError(
          `Too many authentication attempts. Try again in ${resetIn} seconds`,
          429,
          'rate_limit_error'
        ));
      }

      attempt.count++;
      next();
    };
  }
}

// Export middleware functions
module.exports = {
  verify: AuthGuardian.verifyToken,
  optional: AuthGuardian.optionalAuth,
  requireRole: AuthGuardian.requireRole,
  requirePermission: AuthGuardian.requirePermission,
  requireOwnership: AuthGuardian.requireOwnership,
  generateToken: AuthGuardian.generateToken,
  generateRefreshToken: AuthGuardian.generateRefreshToken,
  authRateLimit: AuthGuardian.authRateLimit
};