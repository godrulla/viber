/**
 * Viber Application - The Heart of Connection
 * 
 * This is the main application module that orchestrates all components
 * with zen-like simplicity and architectural elegance.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

const { initializeDatabase, healthCheck } = require('./models');
const config = require('./config/environment');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const authMiddleware = require('./middleware/auth');
const SocketService = require('./services/SocketService');

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const channelRoutes = require('./routes/channels');

class ViberApp {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.cors.origin,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['polling', 'websocket'],
      allowEIO3: true
    });
    
    // Initialize synchronous components
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
    this.initializeSocketHandlers();
  }

  async initialize() {
    try {
      await initializeDatabase();
      logger.info('✅ Database initialized successfully');
      return this;
    } catch (error) {
      logger.error('❌ Database initialization failed', { error: error.message });
      
      // In development, continue without database for API testing
      if (config.isDevelopment()) {
        logger.warn('⚠️  Continuing in development mode without database');
        logger.warn('⚠️  Some features will not work until database is connected');
        return this;
      }
      
      throw error;
    }
  }

  initializeMiddleware() {
    // Compression middleware - efficient data flow
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      }
    }));

    // Security middleware - protection is a form of respect
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
    }));

    this.app.use(cors({
      ...config.cors,
      credentials: true
    }));
    
    // Rate limiting - gentle boundaries for graceful service
    const limiter = rateLimit({
      windowMs: config.security.rateLimitWindow,
      max: config.security.rateLimitMax,
      message: {
        error: 'Too Many Requests',
        message: 'Please slow down and try again later',
        retryAfter: Math.ceil(config.security.rateLimitWindow / 1000),
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    });
    this.app.use('/api', limiter);

    // Body parsing - understanding what others wish to say
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb' 
    }));

    // Request ID middleware
    this.app.use((req, res, next) => {
      req.id = require('crypto').randomUUID();
      res.setHeader('X-Request-ID', req.id);
      next();
    });
    
    // Request logging - awareness of all that flows through
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        logger.info(`${req.method} ${req.path}`, { 
          requestId: req.id,
          ip: req.ip, 
          userAgent: req.get('User-Agent'),
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('Content-Length')
        });
      });
      
      next();
    });

    // Make Socket.IO instance available to routes
    this.app.use((req, res, next) => {
      req.io = this.io;
      next();
    });
  }

  initializeRoutes() {
    // Health check - the pulse of the system with database status
    this.app.get('/health', async (req, res) => {
      try {
        let dbHealth;
        try {
          dbHealth = healthCheck();
        } catch (dbError) {
          dbHealth = {
            status: 'disconnected',
            error: dbError.message
          };
        }

        const socketStatus = {
          connected: this.socketService ? this.socketService.connectedUsers.size : 0,
          rooms: this.io.sockets.adapter.rooms.size
        };

        const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'degraded';

        res.status(200).json({
          status: overallStatus,
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: config.environment,
          database: dbHealth,
          sockets: socketStatus,
          version: '1.0.0',
          warnings: dbHealth.status !== 'healthy' ? ['Database not connected'] : []
        });
      } catch (error) {
        logger.error('Health check error', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        });
      }
    });

    // API Documentation
    this.app.get('/api', (req, res) => {
      res.status(200).json({
        name: 'Viber Messaging API',
        version: '1.0.0',
        description: 'Real-time messaging platform with encryption and AI features',
        documentation: {
          openapi: '/api/docs/openapi.json',
          postman: '/api/docs/postman.json',
          readme: '/api/docs/README.md'
        },
        endpoints: {
          authentication: '/api/v1/auth/*',
          channels: '/api/v1/channels/*',
          messages: '/api/v1/messages/*',
          websocket: '/socket.io/*'
        },
        features: {
          realtime: 'Socket.IO WebSocket connections',
          encryption: 'End-to-end message encryption',
          presence: 'User presence and typing indicators',
          reactions: 'Message reactions and threads',
          media: 'File and media sharing',
          notifications: 'Push notifications'
        },
        timestamp: new Date().toISOString()
      });
    });

    // API Routes - organized and versioned
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/channels', channelRoutes);
    this.app.use('/api/v1/messages', messageRoutes);

    // WebSocket info endpoint
    this.app.get('/socket.io/info', authMiddleware.optional, (req, res) => {
      res.json({
        transport: 'Socket.IO',
        version: require('socket.io/package.json').version,
        connected: req.user ? 'authenticated' : 'anonymous',
        events: {
          connection: 'User connects to socket',
          'message:send': 'Send real-time message',
          'channel:join': 'Join channel room',
          'typing:start': 'Start typing indicator',
          'presence:update': 'Update user presence'
        },
        authentication: 'JWT token required in handshake',
        timestamp: new Date().toISOString()
      });
    });

    // Serve static files for development
    if (config.isDevelopment()) {
      this.app.use('/static', express.static('public'));
    }
  }

  initializeErrorHandling() {
    // 404 handler - gentle guidance for the lost
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Path not found',
        message: 'The path you seek does not exist in this realm',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    });

    // Global error handler - compassionate error transformation
    this.app.use(errorHandler);
  }

  initializeSocketHandlers() {
    // Initialize the advanced Socket.IO service
    this.socketService = new SocketService(this.io);
    
    logger.info('🔌 Socket.IO service initialized', {
      transports: ['polling', 'websocket'],
      cors: config.cors.origin
    });

    // Basic connection logging (detailed logging is in SocketService)
    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.IO connection error', {
        error: err.message,
        code: err.code,
        context: err.context
      });
    });
  }

  async start() {
    try {
      const port = config.port || 3000;
      const host = config.host || 'localhost';
      
      this.server.listen(port, host, () => {
        logger.info(`🌸 Viber application blooming on ${host}:${port}`, {
          environment: config.environment,
          pid: process.pid,
          nodeVersion: process.version,
          endpoints: {
            health: `http://${host}:${port}/health`,
            api: `http://${host}:${port}/api`,
            websocket: `ws://${host}:${port}/socket.io/`
          }
        });

        // Log feature flags
        logger.info('🚀 Feature flags status', config.features);

        // Development helpers
        if (config.isDevelopment()) {
          logger.info('🛠️  Development mode active', {
            logLevel: config.logging.level,
            hotReload: 'enabled',
            staticFiles: '/static/*'
          });
        }
      });

      // Handle server errors
      this.server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`❌ Port ${port} is already in use`);
          process.exit(1);
        } else {
          logger.error('❌ Server error', { error: error.message });
        }
      });

      // Graceful shutdown - all things must end with grace
      process.on('SIGTERM', this.shutdown.bind(this));
      process.on('SIGINT', this.shutdown.bind(this));
      process.on('SIGHUP', this.shutdown.bind(this));

      return { port, host };
    } catch (error) {
      logger.error('❌ Failed to start server', { error: error.message });
      throw error;
    }
  }

  async shutdown() {
    logger.info('🍃 Graceful shutdown initiated...');
    
    try {
      // Close Socket.IO connections
      this.io.close((err) => {
        if (err) {
          logger.error('Socket.IO shutdown error', { error: err.message });
        } else {
          logger.info('🔌 Socket.IO connections closed');
        }
      });

      // Close HTTP server
      this.server.close(async (err) => {
        if (err) {
          logger.error('Server shutdown error', { error: err.message });
          process.exit(1);
        }

        try {
          // Close database connections
          const { closeDatabase } = require('./models');
          await closeDatabase();
          logger.info('🗄️  Database connections closed');
          
          logger.info('🌙 Graceful shutdown completed. Until we meet again.');
          process.exit(0);
        } catch (dbError) {
          logger.error('Database shutdown error', { error: dbError.message });
          process.exit(1);
        }
      });

      // Force close after timeout (30 seconds)
      setTimeout(() => {
        logger.error('❌ Forced shutdown after timeout');
        process.exit(1);
      }, 30000);

    } catch (error) {
      logger.error('❌ Shutdown error', { error: error.message });
      process.exit(1);
    }
  }

  // Utility methods for external access
  getSocketService() {
    return this.socketService;
  }

  getIOInstance() {
    return this.io;
  }

  getExpressApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }
}

module.exports = ViberApp;