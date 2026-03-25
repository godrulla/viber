/**
 * Models Index - The Registry of Digital Entities
 * 
 * Central export point for all database models with connection management
 * and initialization logic.
 */

const mongoose = require('mongoose');
const config = require('../config/environment');
const logger = require('../utils/logger');

// Import all models
const User = require('./User');
const Message = require('./Message');
const Channel = require('./Channel');

/**
 * Database Connection Manager
 * Handles MongoDB connection with proper error handling and reconnection logic
 */
class DatabaseManager {
  constructor() {
    this.isConnected = false;
    this.connectionRetries = 0;
    this.maxRetries = config.isDevelopment() ? 2 : 5;
    this.retryDelay = config.isDevelopment() ? 1000 : 5000; // 1 second in dev, 5 seconds in prod
  }

  async connect() {
    try {
      // Configure mongoose settings
      mongoose.set('strictQuery', false);
      
      // Connection options with enhanced settings
      const connectionOptions = {
        ...config.database.mongodb.options,
        
        // Connection pool settings
        maxPoolSize: config.database.mongodb.options.maxPoolSize,
        minPoolSize: Math.floor(config.database.mongodb.options.maxPoolSize * 0.1),
        
        // Timeout settings
        serverSelectionTimeoutMS: config.database.mongodb.options.serverSelectionTimeoutMS,
        socketTimeoutMS: config.database.mongodb.options.socketTimeoutMS,
        connectTimeoutMS: 30000,
        
        // Heartbeat settings
        heartbeatFrequencyMS: 10000,
        
        // Buffering settings (deprecated options removed)
        bufferCommands: false,
        
        // Write concern
        w: 'majority',
        
        // Read preference
        readPreference: 'primaryPreferred',
        
        // Application name for monitoring
        appName: 'viber-messaging-platform'
      };

      logger.info('Connecting to MongoDB...', {
        uri: config.database.mongodb.uri.replace(/mongodb:\/\/([^:]+:[^@]+)@/, 'mongodb://***:***@'),
        options: {
          maxPoolSize: connectionOptions.maxPoolSize,
          serverSelectionTimeoutMS: connectionOptions.serverSelectionTimeoutMS
        }
      });

      await mongoose.connect(config.database.mongodb.uri, connectionOptions);
      
      this.isConnected = true;
      this.connectionRetries = 0;
      
      logger.info('✅ Successfully connected to MongoDB', {
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        database: mongoose.connection.name,
        readyState: mongoose.connection.readyState
      });

      // Setup connection event listeners
      this.setupEventListeners();
      
      // Initialize indexes
      await this.ensureIndexes();

      return true;

    } catch (error) {
      this.isConnected = false;
      this.connectionRetries++;

      logger.error('❌ Failed to connect to MongoDB', {
        error: error.message,
        attempt: this.connectionRetries,
        maxRetries: this.maxRetries,
        willRetry: this.connectionRetries < this.maxRetries
      });

      // Retry connection if under limit
      if (this.connectionRetries < this.maxRetries) {
        logger.info(`⏳ Retrying MongoDB connection in ${this.retryDelay / 1000} seconds...`);
        await this.delay(this.retryDelay);
        return this.connect();
      } else {
        logger.error('🚫 Maximum MongoDB connection retries exceeded');
        throw error;
      }
    }
  }

  setupEventListeners() {
    // Connection events
    mongoose.connection.on('connected', () => {
      logger.info('📡 MongoDB connection established');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('📴 MongoDB connection lost');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('🔄 MongoDB reconnected successfully');
      this.isConnected = true;
    });

    mongoose.connection.on('error', (error) => {
      logger.error('💥 MongoDB connection error', { error: error.message });
    });

    mongoose.connection.on('close', () => {
      logger.info('🔒 MongoDB connection closed');
      this.isConnected = false;
    });

    // Graceful shutdown
    process.on('SIGINT', this.gracefulShutdown.bind(this));
    process.on('SIGTERM', this.gracefulShutdown.bind(this));
  }

  async ensureIndexes() {
    try {
      logger.info('📊 Ensuring database indexes...');

      // Create indexes for all models
      const indexPromises = [
        User.createIndexes(),
        Message.createIndexes(),
        Channel.createIndexes()
      ];

      await Promise.all(indexPromises);
      
      logger.info('✅ All database indexes created successfully');

      // Log index information in development
      if (config.isDevelopment()) {
        await this.logIndexInfo();
      }

    } catch (error) {
      logger.error('❌ Failed to create database indexes', { error: error.message });
      throw error;
    }
  }

  async logIndexInfo() {
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      for (const collection of collections) {
        const indexes = await mongoose.connection.db.collection(collection.name).indexes();
        logger.debug(`Indexes for ${collection.name}:`, {
          collection: collection.name,
          indexCount: indexes.length,
          indexes: indexes.map(idx => ({
            name: idx.name,
            keys: idx.key,
            unique: idx.unique || false
          }))
        });
      }
    } catch (error) {
      logger.warn('Could not retrieve index information', { error: error.message });
    }
  }

  async gracefulShutdown() {
    logger.info('🛑 Received shutdown signal, closing MongoDB connection...');
    
    try {
      await mongoose.connection.close();
      logger.info('✅ MongoDB connection closed gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('❌ Error during MongoDB shutdown', { error: error.message });
      process.exit(1);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Health check method
  isHealthy() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  // Get connection statistics
  getStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    return {
      connected: true,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections) : [],
      models: mongoose.modelNames()
    };
  }
}

// Create database manager instance
const dbManager = new DatabaseManager();

/**
 * Initialize database connection
 * Should be called during application startup
 */
const initializeDatabase = async () => {
  try {
    await dbManager.connect();
    return true;
  } catch (error) {
    logger.error('🚫 Database initialization failed', { error: error.message });
    throw error;
  }
};

/**
 * Close database connection
 * Should be called during application shutdown
 */
const closeDatabase = async () => {
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      logger.info('🔒 Database connection closed');
    }
  } catch (error) {
    logger.error('❌ Error closing database connection', { error: error.message });
    throw error;
  }
};

/**
 * Database health check
 */
const healthCheck = () => {
  return {
    status: dbManager.isHealthy() ? 'healthy' : 'unhealthy',
    ...dbManager.getStats(),
    timestamp: new Date().toISOString()
  };
};

// Model validation and relationships
const validateModels = () => {
  const models = { User, Message, Channel };
  const issues = [];

  // Check if all models are properly loaded
  Object.entries(models).forEach(([name, model]) => {
    if (!model || typeof model !== 'function') {
      issues.push(`Model ${name} is not properly loaded`);
    }
  });

  // Validate model relationships
  try {
    // Check if User model has required fields
    const userSchema = User.schema;
    const requiredUserFields = ['username', 'email', 'passwordHash'];
    requiredUserFields.forEach(field => {
      if (!userSchema.paths[field]) {
        issues.push(`User model missing required field: ${field}`);
      }
    });

    // Check Message-User relationship
    const messageSchema = Message.schema;
    if (!messageSchema.paths.sender || messageSchema.paths.sender.options.ref !== 'User') {
      issues.push('Message model sender field not properly referencing User model');
    }

    // Check Channel-User relationship
    const channelSchema = Channel.schema;
    if (!channelSchema.paths['members.user'] || channelSchema.paths['members.user'].options.ref !== 'User') {
      issues.push('Channel model members.user field not properly referencing User model');
    }

  } catch (error) {
    issues.push(`Model validation error: ${error.message}`);
  }

  if (issues.length > 0) {
    logger.warn('⚠️ Model validation issues found:', { issues });
    return { valid: false, issues };
  }

  logger.info('✅ All models validated successfully');
  return { valid: true, issues: [] };
};

// Export all models and utilities
module.exports = {
  // Models
  User,
  Message,
  Channel,
  
  // Connection management
  initializeDatabase,
  closeDatabase,
  
  // Utilities
  healthCheck,
  validateModels,
  dbManager,
  
  // Mongoose instance (for advanced usage)
  mongoose
};