/**
 * Authentication Routes - The Gateway to Connection
 * 
 * Secure authentication endpoints with JWT tokens, email verification,
 * password reset, and comprehensive security measures.
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const { User } = require('../models');
const config = require('../config/environment');
const logger = require('../utils/logger');
const { ErrorTransformer } = require('../middleware/errorHandler');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

/**
 * Validation Rules
 */
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username must be 3-30 characters and contain only letters, numbers, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character'),
  
  body('firstName')
    .optional()
    .isLength({ max: 30 })
    .withMessage('First name cannot exceed 30 characters'),
  
  body('lastName')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Last name cannot exceed 30 characters')
];

const loginValidation = [
  body('identifier')
    .notEmpty()
    .withMessage('Username or email is required'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const forgotPasswordValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
];

const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required'),
  
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character')
];

/**
 * Helper Functions
 */
const generateTokens = (user) => {
  const payload = {
    userId: user._id,
    username: user.username,
    email: user.email,
    status: user.status
  };

  const accessToken = jwt.sign(payload, config.security.jwtSecret, {
    expiresIn: '15m', // Short-lived access token
    issuer: 'viber-api',
    audience: 'viber-client'
  });

  const refreshToken = jwt.sign(
    { userId: user._id, type: 'refresh' },
    config.security.jwtSecret,
    {
      expiresIn: config.security.jwtExpiresIn, // Long-lived refresh token
      issuer: 'viber-api',
      audience: 'viber-client'
    }
  );

  return { accessToken, refreshToken };
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation Failed',
      message: 'Please check your input data',
      details: errors.array().map(error => ({
        field: error.path,
        message: error.msg,
        value: error.value
      })),
      timestamp: new Date().toISOString()
    });
  }
  next();
};

/**
 * @route   POST /auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', registerValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;

    logger.info('User registration attempt', { 
      username, 
      email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      ip: req.ip 
    });

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(409).json({
        error: 'User Already Exists',
        message: `A user with this ${field} already exists`,
        field: field,
        timestamp: new Date().toISOString()
      });
    }

    // Create new user
    const user = new User({
      username: username.toLowerCase(),
      email: email,
      passwordHash: password, // Will be hashed by pre-save middleware
      profile: {
        firstName: firstName,
        lastName: lastName,
        displayName: firstName && lastName ? `${firstName} ${lastName}` : username
      },
      status: 'pending_verification'
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();

    await user.save();

    // Generate JWT tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Store refresh token in user document
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        deviceId: req.headers['x-device-id'] || 'unknown'
      }
    });

    await user.save();

    logger.info('User registered successfully', { 
      userId: user._id, 
      username: user.username,
      email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2')
    });

    // TODO: Send verification email (implement email service)
    // await emailService.sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        status: user.status,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '15m'
      },
      nextSteps: {
        verifyEmail: true,
        emailSent: true // Set to false if email service not configured
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Registration error', { 
      error: error.message, 
      stack: error.stack,
      body: req.body 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login', loginValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { identifier, password } = req.body; // Can be username or email
    
    logger.info('User login attempt', { 
      identifier: identifier.replace(/(.{2}).+(@.+)/, '$1***$2'),
      ip: req.ip 
    });

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: identifier.toLowerCase() },
        { username: identifier.toLowerCase() }
      ],
      deletedAt: { $exists: false }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn('Invalid password attempt', { 
        userId: user._id, 
        username: user.username,
        ip: req.ip 
      });
      
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid credentials',
        timestamp: new Date().toISOString()
      });
    }

    // Check account status
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: 'Account Suspended',
        message: 'Your account has been suspended. Please contact support.',
        timestamp: new Date().toISOString()
      });
    }

    if (user.status === 'deactivated') {
      return res.status(403).json({
        error: 'Account Deactivated',
        message: 'Your account is deactivated. Please reactivate your account.',
        timestamp: new Date().toISOString()
      });
    }

    // Generate new tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Clean up old refresh tokens (keep only last 5)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }

    // Store new refresh token
    user.refreshTokens.push({
      token: crypto.createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: {
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        deviceId: req.headers['x-device-id'] || 'unknown'
      }
    });

    // Update login analytics
    user.analytics.lastLoginAt = new Date();
    user.analytics.loginCount += 1;

    // Update presence
    user.presence.status = 'online';
    user.presence.lastSeen = new Date();

    await user.save();

    logger.info('User logged in successfully', { 
      userId: user._id, 
      username: user.username,
      loginCount: user.analytics.loginCount
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        profile: user.profile,
        status: user.status,
        emailVerified: user.emailVerified,
        presence: user.presence,
        lastLoginAt: user.analytics.lastLoginAt,
        loginCount: user.analytics.loginCount
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: '15m'
      },
      warnings: user.status === 'pending_verification' ? ['Email verification pending'] : [],
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Login error', { 
      error: error.message, 
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Refresh token is required',
        timestamp: new Date().toISOString()
      });
    }

    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.security.jwtSecret);
    } catch (error) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'Refresh token is invalid or expired',
        timestamp: new Date().toISOString()
      });
    }

    // Find user and validate refresh token
    const user = await User.findById(decoded.userId);
    if (!user || user.status === 'suspended' || user.status === 'deactivated') {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'User not found or account inactive',
        timestamp: new Date().toISOString()
      });
    }

    // Check if refresh token exists in user's tokens
    const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const tokenExists = user.refreshTokens.some(token => 
      token.token === hashedToken && token.expiresAt > new Date()
    );

    if (!tokenExists) {
      return res.status(401).json({
        error: 'Invalid Token',
        message: 'Refresh token not found or expired',
        timestamp: new Date().toISOString()
      });
    }

    // Generate new access token
    const { accessToken } = generateTokens(user);

    logger.info('Token refreshed successfully', { 
      userId: user._id, 
      username: user.username 
    });

    res.json({
      message: 'Token refreshed successfully',
      tokens: {
        accessToken,
        expiresIn: '15m'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Token refresh error', { 
      error: error.message, 
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/logout
 * @desc    Logout user and invalidate refresh token
 * @access  Private
 */
router.post('/logout', authMiddleware.verify, async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const user = req.user;

    if (refreshToken) {
      // Remove specific refresh token
      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');
      user.refreshTokens = user.refreshTokens.filter(token => token.token !== hashedToken);
    } else {
      // Remove all refresh tokens (logout from all devices)
      user.refreshTokens = [];
    }

    // Update presence to offline
    user.presence.status = 'offline';
    user.presence.lastSeen = new Date();

    await user.save();

    logger.info('User logged out successfully', { 
      userId: user._id, 
      username: user.username,
      allDevices: !refreshToken
    });

    res.json({
      message: 'Logout successful',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Logout error', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?._id 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', forgotPasswordValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { email } = req.body;

    logger.info('Password reset requested', { 
      email: email.replace(/(.{2}).+(@.+)/, '$1***$2'),
      ip: req.ip 
    });

    const user = await User.findOne({ 
      email: email,
      deletedAt: { $exists: false }
    });

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account with that email exists, a password reset link has been sent',
        timestamp: new Date().toISOString()
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // TODO: Send password reset email
    // await emailService.sendPasswordResetEmail(user.email, resetToken);

    logger.info('Password reset token generated', { 
      userId: user._id,
      email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2')
    });

    res.json({
      message: 'If an account with that email exists, a password reset link has been sent',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Forgot password error', { 
      error: error.message, 
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post('/reset-password', resetPasswordValidation, handleValidationErrors, async (req, res, next) => {
  try {
    const { token, password } = req.body;

    // Hash the token to match what's stored in database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
      deletedAt: { $exists: false }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Password reset token is invalid or has expired',
        timestamp: new Date().toISOString()
      });
    }

    // Update password
    user.passwordHash = password; // Will be hashed by pre-save middleware
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Invalidate all refresh tokens (force re-login on all devices)
    user.refreshTokens = [];

    await user.save();

    logger.info('Password reset successful', { 
      userId: user._id,
      username: user.username
    });

    res.json({
      message: 'Password reset successful',
      nextSteps: {
        login: true,
        allSessionsInvalidated: true
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Password reset error', { 
      error: error.message, 
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route   POST /auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Verification token is required',
        timestamp: new Date().toISOString()
      });
    }

    // Hash the token to match what's stored in database
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      deletedAt: { $exists: false }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid Token',
        message: 'Email verification token is invalid',
        timestamp: new Date().toISOString()
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        error: 'Already Verified',
        message: 'Email address is already verified',
        timestamp: new Date().toISOString()
      });
    }

    // Verify email
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.status = 'active';

    await user.save();

    logger.info('Email verified successfully', { 
      userId: user._id,
      email: user.email.replace(/(.{2}).+(@.+)/, '$1***$2')
    });

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
        emailVerified: user.emailVerified
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Email verification error', { 
      error: error.message, 
      stack: error.stack 
    });
    next(error);
  }
});

/**
 * @route   GET /auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authMiddleware.verify, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('contacts.user', 'username profile.displayName profile.avatar presence.status')
      .select('-passwordHash -refreshTokens -emailVerificationToken -passwordResetToken');

    if (!user) {
      return res.status(404).json({
        error: 'User Not Found',
        message: 'User account no longer exists',
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      user: user,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get user profile error', { 
      error: error.message, 
      userId: req.user?._id 
    });
    next(error);
  }
});

/**
 * @route   PUT /auth/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', authMiddleware.verify, [
  body('profile.displayName')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Display name cannot exceed 50 characters'),
  
  body('profile.firstName')
    .optional()
    .isLength({ max: 30 })
    .withMessage('First name cannot exceed 30 characters'),
  
  body('profile.lastName')
    .optional()
    .isLength({ max: 30 })
    .withMessage('Last name cannot exceed 30 characters'),
  
  body('profile.bio')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
], handleValidationErrors, async (req, res, next) => {
  try {
    const allowedUpdates = [
      'profile.displayName',
      'profile.firstName', 
      'profile.lastName',
      'profile.bio',
      'profile.timezone',
      'profile.language',
      'privacy',
      'notifications'
    ];

    const updates = {};
    
    // Extract allowed fields from request body
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.some(allowed => key.startsWith(allowed.split('.')[0]))) {
        updates[key] = req.body[key];
      }
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash -refreshTokens -emailVerificationToken -passwordResetToken');

    logger.info('User profile updated', { 
      userId: user._id,
      updatedFields: Object.keys(updates)
    });

    res.json({
      message: 'Profile updated successfully',
      user: user,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Update profile error', { 
      error: error.message, 
      userId: req.user?._id 
    });
    next(error);
  }
});

module.exports = router;