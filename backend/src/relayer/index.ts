/**
 * @fileoverview Relayer service entry point
 * @description HTTP API server for intent ingestion and validation
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import config from '@/shared/config/index.js';

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
  max: config.api.rateLimit.max,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'relayer',
    version: '0.1.0',
  });
});

// Import routes
import intentRoutes from './routes/intents.js';
import { requestLoggingMiddleware } from '@/utils/index.js';

// Add request logging
app.use(requestLoggingMiddleware('relayer'));

// API routes
app.use('/api/intents', intentRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.isDevelopment ? err.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Start server
const server = app.listen(config.server.apiPort, config.server.host, () => {
  console.log(`🚀 Relayer service running on http://${config.server.host}:${config.server.apiPort}`);
  console.log(`📊 Environment: ${config.env}`);
  console.log(`🔗 Chain ID: ${config.blockchain.chainId}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Relayer service shut down');
    process.exit(0);
  });
});

export default app;