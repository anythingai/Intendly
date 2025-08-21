/**
 * @fileoverview API-related type definitions
 * @description Request/response types for REST API endpoints
 */

import { Intent, IntentStatus } from './intent.js';
import { BidLike, BidSubmission, BidResponse, BestBidResponse } from './bid.js';

// ============ Request Types ============

export interface CreateIntentRequest {
  intent: Intent;
  signature: string;
}

export interface SubmitBidRequest extends BidSubmission {}

export interface GetIntentRequest {
  intentHash: string;
}

export interface GetBestBidRequest {
  intentHash: string;
}

// ============ Response Types ============

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

export interface SubmitBidResponse extends BidResponse {}

export interface GetBestBidResponse extends BestBidResponse {}

// ============ WebSocket Message Types ============

export type WSMessage = 
  | IntentCreatedMessage
  | BidReceivedMessage
  | BestBidUpdatedMessage
  | IntentFilledMessage
  | IntentExpiredMessage
  | ErrorMessage;

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
  };
}

export interface BestBidUpdatedMessage {
  type: 'BestBidUpdated';
  data: {
    intentHash: string;
    bestBid: BidLike;
    score: number;
    improvement: string; // bps vs baseline
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
  };
}

// ============ Error Response Types ============

export interface ApiError {
  status: 'error';
  message: string;
  code?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ApiErrorResponse extends ApiError {
  validationErrors?: ValidationError[];
}

// ============ Health Check Types ============

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    websocket: 'healthy' | 'unhealthy';
  };
  metrics?: {
    totalIntents: number;
    totalBids: number;
    activeConnections: number;
    avgResponseTime: number;
  };
}

// ============ Pagination Types ============

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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
  };
}

// ============ Rate Limiting Types ============

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

// ============ Metrics Types ============

export interface ApiMetrics {
  requests: {
    total: number;
    success: number;
    errors: number;
    rate: number; // requests per second
  };
  intents: {
    created: number;
    filled: number;
    expired: number;
    averageProcessingTime: number;
  };
  bids: {
    submitted: number;
    accepted: number;
    rejected: number;
    averageBidsPerIntent: number;
  };
  websocket: {
    connections: number;
    messagesPublished: number;
    messagesReceived: number;
  };
}