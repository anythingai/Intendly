/**
 * @fileoverview API-related type definitions
 * @description Request/response types for REST API endpoints and WebSocket messages
 */

import { Intent, IntentStatus, IntentHash } from './intent.js';
import { BidLike, BidSubmission, BidResponse, BestBidResponse } from './bid.js';

// ============================================================================
// HTTP API Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
  timestamp: string;
}

/**
 * Error response structure
 */
export interface ApiError {
  status: 'error';
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
  validationErrors?: ValidationError[];
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

export interface CreateIntentRequest {
  intent: Intent;
  signature: string;
}

export interface CreateIntentResponse {
  intentHash: string;
  biddingWindowMs: number;
  expiresAt: string;
  status: 'success' | 'error';
  message?: string;
}

export interface GetIntentResponse {
  intent: Intent;
  status: IntentStatus;
  createdAt: string;
  expiresAt: string;
  totalBids?: number;
}

export interface SubmitBidRequest extends BidSubmission {}
export interface SubmitBidResponse extends BidResponse {}
export interface GetBestBidResponse extends BestBidResponse {}

// ============================================================================
// WebSocket Message Types
// ============================================================================

export type WSMessage = 
  | IntentCreatedMessage
  | BidReceivedMessage
  | BestBidUpdatedMessage
  | IntentFilledMessage
  | IntentExpiredMessage
  | ErrorMessage
  | HeartbeatMessage;

export interface IntentCreatedMessage {
  type: 'IntentCreated';
  data: {
    intentHash: string;
    intent: {
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
      maxSlippageBps: number;
      deadline: string;
      receiver: string;
    };
    biddingWindowMs: number;
    createdAt: string;
  };
}

export interface BidReceivedMessage {
  type: 'BidReceived';
  data: {
    intentHash: string;
    solverId: string;
    quoteOut: string;
    solverFeeBps: number;
    rank: number;
    timestamp: string;
  };
}

export interface BestBidUpdatedMessage {
  type: 'BestBidUpdated';
  data: {
    intentHash: string;
    bestBid: BidLike;
    score: number;
    improvement: string;
    timestamp: string;
  };
}

export interface IntentFilledMessage {
  type: 'IntentFilled';
  data: {
    intentHash: string;
    txHash: string;
    amountOut: string;
    solverFeePaid: string;
    filledAt: string;
  };
}

export interface IntentExpiredMessage {
  type: 'IntentExpired';
  data: {
    intentHash: string;
    reason: string;
    expiredAt: string;
  };
}

export interface ErrorMessage {
  type: 'Error';
  data: {
    error: string;
    code?: string;
    intentHash?: string;
    timestamp: string;
  };
}

export interface HeartbeatMessage {
  type: 'Heartbeat';
  data: {
    timestamp: string;
    serverTime: number;
  };
}

// ============================================================================
// Pagination and Filtering
// ============================================================================

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  cursor?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor?: string;
    prevCursor?: string;
  };
}

// ============================================================================
// Health and Status
// ============================================================================

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    websocket: ServiceStatus;
    blockchain: ServiceStatus;
  };
  metrics?: SystemMetrics;
}

export interface ServiceStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  lastCheck?: string;
  error?: string;
}

export interface SystemMetrics {
  totalIntents: number;
  totalBids: number;
  activeConnections: number;
  avgResponseTime: number;
  errorRate: number;
  throughput: number; // requests per second
}

// ============================================================================
// Rate Limiting
// ============================================================================

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}