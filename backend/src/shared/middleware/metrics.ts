/**
 * @fileoverview Metrics collection and monitoring middleware
 * @description Prometheus-compatible metrics for monitoring system performance
 */

import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';
import { appLogger as logger } from '@/utils/index.js';
import config from '../config/index.js';

// Create metrics registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({
  register,
  prefix: 'intendly_',
});

// HTTP request metrics
const httpRequestDuration = new client.Histogram({
  name: 'intendly_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10],
  registers: [register],
});

const httpRequestsTotal = new client.Counter({
  name: 'intendly_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'],
  registers: [register],
});

const httpRequestSize = new client.Histogram({
  name: 'intendly_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

const httpResponseSize = new client.Histogram({
  name: 'intendly_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route', 'status_code', 'service'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// Intent-specific metrics
const intentsTotal = new client.Counter({
  name: 'intendly_intents_total',
  help: 'Total number of intents processed',
  labelNames: ['status', 'token_in', 'token_out'],
  registers: [register],
});

const intentProcessingDuration = new client.Histogram({
  name: 'intendly_intent_processing_duration_seconds',
  help: 'Intent processing duration in seconds',
  labelNames: ['status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

const intentBidsReceived = new client.Counter({
  name: 'intendly_intent_bids_received_total',
  help: 'Total number of bids received per intent',
  labelNames: ['intent_hash'],
  registers: [register],
});

// Bid-specific metrics
const bidsTotal = new client.Counter({
  name: 'intendly_bids_total',
  help: 'Total number of bids processed',
  labelNames: ['status', 'solver_id'],
  registers: [register],
});

const bidProcessingDuration = new client.Histogram({
  name: 'intendly_bid_processing_duration_seconds',
  help: 'Bid processing duration in seconds',
  labelNames: ['status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const bidScore = new client.Histogram({
  name: 'intendly_bid_score',
  help: 'Bid scoring results',
  labelNames: ['solver_id'],
  buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  registers: [register],
});

// Solver metrics
const solverConnections = new client.Gauge({
  name: 'intendly_solver_connections_active',
  help: 'Number of active solver connections',
  registers: [register],
});

const solverResponseTime = new client.Histogram({
  name: 'intendly_solver_response_time_seconds',
  help: 'Solver response time for bids',
  labelNames: ['solver_id'],
  buckets: [0.1, 0.5, 1, 2, 3, 5, 10],
  registers: [register],
});

// WebSocket metrics
const websocketConnections = new client.Gauge({
  name: 'intendly_websocket_connections_active',
  help: 'Number of active WebSocket connections',
  labelNames: ['connection_type'],
  registers: [register],
});

const websocketMessages = new client.Counter({
  name: 'intendly_websocket_messages_total',
  help: 'Total WebSocket messages sent/received',
  labelNames: ['direction', 'message_type'],
  registers: [register],
});

// Database metrics
const databaseConnections = new client.Gauge({
  name: 'intendly_database_connections_active',
  help: 'Number of active database connections',
  registers: [register],
});

const databaseQueryDuration = new client.Histogram({
  name: 'intendly_database_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

// Redis metrics
const redisOperations = new client.Counter({
  name: 'intendly_redis_operations_total',
  help: 'Total Redis operations',
  labelNames: ['operation', 'status'],
  registers: [register],
});

const redisOperationDuration = new client.Histogram({
  name: 'intendly_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export class MetricsCollector {
  /**
   * HTTP request metrics middleware
   */
  static httpMetrics(serviceName: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestSize = req.get('content-length') || '0';

      // Track request
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const duration = (Date.now() - startTime) / 1000;
        const route = req.route?.path || req.path;
        const responseSize = chunk ? chunk.length : 0;

        // Record metrics
        httpRequestDuration
          .labels(req.method, route, res.statusCode.toString(), serviceName)
          .observe(duration);

        httpRequestsTotal
          .labels(req.method, route, res.statusCode.toString(), serviceName)
          .inc();

        httpRequestSize
          .labels(req.method, route, serviceName)
          .observe(parseInt(requestSize));

        httpResponseSize
          .labels(req.method, route, res.statusCode.toString(), serviceName)
          .observe(responseSize);

        originalEnd.call(res, chunk, encoding);
      };

      next();
    };
  }

  /**
   * Record intent metrics
   */
  static recordIntent(status: string, tokenIn: string, tokenOut: string, duration?: number) {
    intentsTotal.labels(status, tokenIn, tokenOut).inc();
    
    if (duration !== undefined) {
      intentProcessingDuration.labels(status).observe(duration);
    }
  }

  /**
   * Record bid metrics
   */
  static recordBid(status: string, solverId: string, duration?: number, score?: number) {
    bidsTotal.labels(status, solverId).inc();
    
    if (duration !== undefined) {
      bidProcessingDuration.labels(status).observe(duration);
    }

    if (score !== undefined) {
      bidScore.labels(solverId).observe(score);
    }
  }

  /**
   * Record intent bid received
   */
  static recordIntentBid(intentHash: string) {
    intentBidsReceived.labels(intentHash).inc();
  }

  /**
   * Update solver metrics
   */
  static updateSolverConnections(count: number) {
    solverConnections.set(count);
  }

  /**
   * Record solver response time
   */
  static recordSolverResponseTime(solverId: string, responseTime: number) {
    solverResponseTime.labels(solverId).observe(responseTime);
  }

  /**
   * Update WebSocket connection metrics
   */
  static updateWebSocketConnections(type: string, count: number) {
    websocketConnections.labels(type).set(count);
  }

  /**
   * Record WebSocket message
   */
  static recordWebSocketMessage(direction: 'sent' | 'received', messageType: string) {
    websocketMessages.labels(direction, messageType).inc();
  }

  /**
   * Update database connection metrics
   */
  static updateDatabaseConnections(count: number) {
    databaseConnections.set(count);
  }

  /**
   * Record database query metrics
   */
  static recordDatabaseQuery(operation: string, table: string, duration: number) {
    databaseQueryDuration.labels(operation, table).observe(duration);
  }

  /**
   * Record Redis operation metrics
   */
  static recordRedisOperation(operation: string, status: 'success' | 'error', duration: number) {
    redisOperations.labels(operation, status).inc();
    redisOperationDuration.labels(operation).observe(duration);
  }

  /**
   * Get metrics registry
   */
  static getRegistry() {
    return register;
  }

  /**
   * Get metrics endpoint handler
   */
  static getMetricsHandler() {
    return async (req: Request, res: Response) => {
      try {
        const metrics = await register.metrics();
        res.set('Content-Type', register.contentType);
        res.end(metrics);
      } catch (error) {
        logger.error('Failed to collect metrics', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        res.status(500).json({
          status: 'error',
          message: 'Failed to collect metrics',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Clear all metrics (for testing)
   */
  static clearMetrics() {
    register.clear();
  }
}

// Create business metrics for intent-based trading
export const BusinessMetrics = {
  // Trading volume metrics
  tradingVolume: new client.Gauge({
    name: 'intendly_trading_volume_usd',
    help: 'Total trading volume in USD',
    labelNames: ['token_pair', 'time_period'],
    registers: [register],
  }),

  // Fill rates
  intentFillRate: new client.Gauge({
    name: 'intendly_intent_fill_rate',
    help: 'Percentage of intents successfully filled',
    labelNames: ['time_period'],
    registers: [register],
  }),

  // Price improvement
  priceImprovement: new client.Histogram({
    name: 'intendly_price_improvement_bps',
    help: 'Price improvement in basis points compared to market rates',
    labelNames: ['token_pair'],
    buckets: [-100, -50, -10, 0, 10, 25, 50, 100, 200, 500],
    registers: [register],
  }),

  // Settlement times
  settlementTime: new client.Histogram({
    name: 'intendly_settlement_time_seconds',
    help: 'Time from intent submission to settlement',
    buckets: [1, 5, 10, 30, 60, 300, 600],
    registers: [register],
  }),

  // Revenue metrics
  protocolFees: new client.Counter({
    name: 'intendly_protocol_fees_collected_usd',
    help: 'Protocol fees collected in USD',
    registers: [register],
  }),

  // Solver performance
  solverWinRate: new client.Gauge({
    name: 'intendly_solver_win_rate',
    help: 'Solver win rate percentage',
    labelNames: ['solver_id'],
    registers: [register],
  }),
};

export default MetricsCollector;