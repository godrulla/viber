/**
 * Environment Configuration - The Foundation of Adaptability
 * 
 * Centralized configuration management with environment-aware defaults
 * and validation. A system that knows itself in all contexts.
 */

const path = require('path');

class EnvironmentConfig {
  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.loadConfiguration();
    this.validateConfiguration();
  }

  loadConfiguration() {
    // Core application settings
    this.port = this.getNumber('PORT', 3000);
    this.host = process.env.HOST || 'localhost';
    
    // Database configuration
    this.database = {
      mongodb: {
        uri: process.env.MONGODB_URI || `mongodb://localhost:27017/viber_${this.environment}`,
        options: {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          maxPoolSize: this.getNumber('DB_MAX_POOL_SIZE', 10),
          serverSelectionTimeoutMS: this.getNumber('DB_SELECTION_TIMEOUT', this.isDevelopment() ? 2000 : 5000),
          socketTimeoutMS: this.getNumber('DB_SOCKET_TIMEOUT', 45000),
        }
      },
      redis: {
        uri: process.env.REDIS_URI || 'redis://localhost:6379',
        options: {
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
          lazyConnect: true
        }
      }
    };

    // Security configuration
    this.security = {
      jwtSecret: process.env.JWT_SECRET || this.generateDefaultSecret(),
      jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
      bcryptRounds: this.getNumber('BCRYPT_ROUNDS', 12),
      rateLimitWindow: this.getNumber('RATE_LIMIT_WINDOW', 15 * 60 * 1000), // 15 minutes
      rateLimitMax: this.getNumber('RATE_LIMIT_MAX', 1000)
    };

    // CORS configuration
    this.cors = {
      origin: this.getArray('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:8080']),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id', 'x-request-id', 'X-User-Agent', 'x-user-agent', 'X-Device-Type', 'x-device-type'],
      exposedHeaders: ['X-Request-Id', 'x-request-id']
    };

    // Logging configuration
    this.logging = {
      level: process.env.LOG_LEVEL || (this.isDevelopment() ? 'debug' : 'info'),
      file: {
        enabled: this.getBoolean('LOG_FILE_ENABLED', !this.isDevelopment()),
        path: process.env.LOG_FILE_PATH || path.join(process.cwd(), 'logs'),
        maxSize: process.env.LOG_MAX_SIZE || '10m',
        maxFiles: this.getNumber('LOG_MAX_FILES', 5)
      },
      console: {
        enabled: this.getBoolean('LOG_CONSOLE_ENABLED', true),
        colorize: this.isDevelopment()
      }
    };

    // Feature flags - enabling progressive enhancement
    this.features = {
      aiIntegration: this.getBoolean('FEATURE_AI_INTEGRATION', false),
      messageEncryption: this.getBoolean('FEATURE_MESSAGE_ENCRYPTION', true),
      fileSharing: this.getBoolean('FEATURE_FILE_SHARING', true),
      voiceMessages: this.getBoolean('FEATURE_VOICE_MESSAGES', false),
      videoChat: this.getBoolean('FEATURE_VIDEO_CHAT', false)
    };

    // External service configuration
    this.services = {
      openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        maxTokens: this.getNumber('OPENAI_MAX_TOKENS', 1000)
      },
      aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
        s3Bucket: process.env.AWS_S3_BUCKET
      }
    };
  }

  validateConfiguration() {
    const errors = [];

    // Critical validations
    if (this.isProduction() && this.security.jwtSecret.includes('default')) {
      errors.push('JWT_SECRET must be set in production environment');
    }

    if (this.features.aiIntegration && !this.services.openai.apiKey) {
      errors.push('OPENAI_API_KEY required when AI integration is enabled');
    }

    if (this.features.fileSharing && !this.services.aws.accessKeyId) {
      errors.push('AWS credentials required when file sharing is enabled');
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }

  // Environment helpers
  isDevelopment() {
    return this.environment === 'development';
  }

  isProduction() {
    return this.environment === 'production';
  }

  isTesting() {
    return this.environment === 'test';
  }

  // Type conversion helpers
  getNumber(key, defaultValue = 0) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  getBoolean(key, defaultValue = false) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  getArray(key, defaultValue = []) {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }

  generateDefaultSecret() {
    if (this.isProduction()) {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    
    // Generate a default secret for development
    const crypto = require('crypto');
    return `viber-default-${crypto.randomBytes(32).toString('hex')}`;
  }

  // Configuration summary for debugging
  getSummary() {
    return {
      environment: this.environment,
      port: this.port,
      host: this.host,
      features: this.features,
      security: {
        jwtExpiresIn: this.security.jwtExpiresIn,
        bcryptRounds: this.security.bcryptRounds,
        rateLimitMax: this.security.rateLimitMax
      },
      logging: this.logging,
      cors: {
        origin: this.cors.origin,
        methods: this.cors.methods
      }
    };
  }
}

module.exports = new EnvironmentConfig();