#!/usr/bin/env node

/**
 * Viber Entry Point - The Beginning of All Connections
 * 
 * This is where the journey begins. Simple, clean, purposeful.
 * The entry point that awakens the application with zen-like grace.
 */

// Ensure environment is loaded before anything else
require('dotenv').config();

const ViberApp = require('./src/app');
const logger = require('./src/utils/logger');
const config = require('./src/config/environment');

// Handle uncaught exceptions with grace
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception - System terminating', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
});

// Graceful startup
async function startup() {
  try {
    logger.info('🌱 Viber application initializing...', {
      nodeVersion: process.version,
      environment: config.environment,
      pid: process.pid
    });

    // Create and initialize the application
    const app = new ViberApp();
    await app.initialize();
    await app.start();

    // Log configuration summary in development
    if (config.isDevelopment()) {
      logger.debug('Configuration loaded successfully', config.getSummary());
    }

    logger.info('🎉 Viber application started successfully');

  } catch (error) {
    logger.error('❌ Failed to start Viber application', error);
    process.exit(1);
  }
}

// Begin the journey
startup();