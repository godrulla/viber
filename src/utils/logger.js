/**
 * Logging Utility - The Observer of All Actions
 * 
 * Mindful logging that captures the essence of system behavior
 * while maintaining clarity and purpose in every entry.
 */

const winston = require('winston');
const path = require('path');
const config = require('../config/environment');

class ZenLogger {
  constructor() {
    this.logger = this.createLogger();
  }

  createLogger() {
    const transports = [];

    // Console transport - immediate awareness
    if (config.logging.console.enabled) {
      transports.push(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.colorize({ all: config.logging.console.colorize }),
          winston.format.printf(this.formatConsoleMessage)
        )
      }));
    }

    // File transport - persistent memory
    if (config.logging.file.enabled) {
      const logDir = config.logging.file.path;
      
      // Ensure log directory exists
      const fs = require('fs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      transports.push(new winston.transports.File({
        filename: path.join(logDir, 'viber.log'),
        maxsize: this.parseSize(config.logging.file.maxSize),
        maxFiles: config.logging.file.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }));

      // Separate error log for critical issues
      transports.push(new winston.transports.File({
        filename: path.join(logDir, 'viber-error.log'),
        level: 'error',
        maxsize: this.parseSize(config.logging.file.maxSize),
        maxFiles: config.logging.file.maxFiles,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json()
        )
      }));
    }

    return winston.createLogger({
      level: config.logging.level,
      transports,
      // Prevent crash on logging errors
      exitOnError: false,
      // Handle uncaught exceptions
      handleExceptions: true,
      handleRejections: true
    });
  }

  formatConsoleMessage(info) {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length > 0 ? 
      `\n${JSON.stringify(meta, null, 2)}` : '';
    
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaString}`;
  }

  parseSize(sizeString) {
    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };

    const match = sizeString.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const [, size, unit] = match;
    return parseInt(size) * (units[unit] || 1);
  }

  // Logging methods with zen-like awareness
  debug(message, meta = {}) {
    this.logger.debug(message, { ...meta, context: this.getContext() });
  }

  info(message, meta = {}) {
    this.logger.info(message, { ...meta, context: this.getContext() });
  }

  warn(message, meta = {}) {
    this.logger.warn(message, { ...meta, context: this.getContext() });
  }

  error(message, meta = {}) {
    // If meta is an Error object, extract its properties
    if (meta instanceof Error) {
      meta = {
        error: meta.message,
        stack: meta.stack,
        name: meta.name,
        code: meta.code
      };
    }

    this.logger.error(message, { ...meta, context: this.getContext() });
  }

  // Performance tracking
  startTimer(label) {
    const start = process.hrtime.bigint();
    
    return {
      end: (message = `Timer ${label} completed`) => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        this.info(message, { 
          timer: label, 
          duration: `${duration.toFixed(2)}ms`,
          performanceMarker: true
        });
        
        return duration;
      }
    };
  }

  // Request/Response logging helpers
  logRequest(req, res, next) {
    const timer = this.startTimer(`${req.method} ${req.path}`);
    
    // Capture response when it finishes
    res.on('finish', () => {
      timer.end(`Request completed`);
      
      this.info(`${req.method} ${req.path} - ${res.statusCode}`, {
        request: {
          method: req.method,
          path: req.path,
          query: req.query,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        },
        response: {
          statusCode: res.statusCode,
          contentLength: res.get('Content-Length')
        }
      });
    });

    next();
  }

  // Get execution context for better debugging
  getContext() {
    const error = new Error();
    const stack = error.stack?.split('\n');
    
    if (stack && stack.length > 3) {
      const caller = stack[3].trim();
      const match = caller.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
      
      if (match) {
        const [, functionName, filePath, line, column] = match;
        return {
          function: functionName !== 'Object.<anonymous>' ? functionName : 'anonymous',
          file: path.basename(filePath),
          line: parseInt(line),
          column: parseInt(column)
        };
      }
    }
    
    return { source: 'unknown' };
  }

  // Health check for logging system
  healthCheck() {
    try {
      this.info('Logger health check - all systems flowing smoothly');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      console.error('Logger health check failed:', error);
      return { status: 'unhealthy', error: error.message };
    }
  }
}

module.exports = new ZenLogger();