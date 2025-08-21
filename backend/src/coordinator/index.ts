/**
 * @fileoverview Coordinator service entry point
 * @description HTTP API server for bid coordination and winner selection
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from '@/shared/config/index.js';
import { coordinatorLogger as logger, requestLoggingMiddleware, redis } from '@/utils/index.js';
import { db } from '@/database/connection.js';

// Import routes
import bidRoutes from './routes/bids.js';

const app = express();

// Security middleware
if (config.security.helmetEnabled) {
  app.use(helmet());
}

// CORS configuration
app.use(cors({
  origin: config.security.corsOrigins,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: config.api.rateLimit.windowMs,
  max: config.api.rateLimit.max * 2, // Higher limit for coordinator
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Add request logging
app.use(requestLoggingMiddleware('coordinator'));

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'coordinator',
    version: '0.1.0',
    checks: {
      database: 'healthy',
      redis: 'healthy',
    }
  };

  try {
    // Check database
    const dbHealth = await db.healthCheck();
    health.checks.database = dbHealth.status;

    // Check Redis
    const redisHealth = await redis.healthCheck();
    health.checks.redis = redisHealth.status;

    // Overall status
    if (health.checks.database !== 'healthy' || health.checks.redis !== 'healthy') {
      health.status = 'degraded';
      res.status(503);
    }

  } catch (error) {
    health.status = 'unhealthy';
    health.checks.database = 'unhealthy';
    health.checks.redis = 'unhealthy';
    res.status(503);
  }

  res.json(health);
});

// API routes
app.use('/api/bids', bidRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: config.isDevelopment ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  res.status(500).json({
    status: 'error',
    message: config.isDevelopment ? err.message : 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Initialize services
async function initializeServices() {
  try {
    // Connect to database
    await db.connect();
    
    // Connect to Redis
    await redis.connect();

    // Subscribe to coordinator events
    await redis.subscribe('coordinator:bid_selection', async (message) => {
      if (message.data.type === 'SelectWinningBid') {
        logger.info('Received bid selection request', {
          intentHash: message.data.intentHash
        });
        
        // Import bid service dynamically to avoid circular dependencies
        const { BidService } = await import('./services/bidService.js');
        await BidService.selectWinningBid(message.data.intentHash);
      }
    });

    logger.info('✅ Coordinator services initialized');

  } catch (error) {
    logger.error('❌ Failed to initialize coordinator services', { error });
    throw error;
  }
}

// Start server
const server = app.listen(config.server.apiPort, config.server.host, async () => {
  logger.info(`🚀 Coordinator service running on http://${config.server.host}:${config.server.apiPort}`);
  logger.info(`📊 Environment: ${config.env}`);
  logger.info(`🔗 Chain ID: ${config.blockchain.chainId}`);

  try {
    await initializeServices();
    logger.info('🎉 Coordinator service ready to accept requests');
  } catch (error) {
    logger.error('Failed to initialize services, shutting down', { error });
    process.exit(1);
  }
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down gracefully`);
  
  // Stop accepting new connections
  server.close(async () => {
    try {
      // Close database connection
      await db.close();
      
      // Close Redis connections
      await redis.disconnect();
      
      logger.info('Coordinator service shut down successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

export default app;