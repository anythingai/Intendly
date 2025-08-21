/**
 * @fileoverview Core type definitions for Solver SDK
 * @description Types and interfaces for building solvers
 */

export interface Intent {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: string;
  chainId: string;
  receiver: string;
  nonce: string;
}

export interface BidResponse {
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
  ttlMs: number;
}

export interface BaseBidStrategy {
  generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null>;
}

export interface SolverConfig {
  solverPrivateKey: string;
  coordinatorUrl: string;
  wsUrl: string;
  chainId: number;
  rpcUrl?: string;
  settlementContract?: string;
  bidStrategy?: BaseBidStrategy;
  maxResponseTimeMs?: number;
  maxConcurrentBids?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  enablePerformanceMonitoring?: boolean;
  enableAutoReconnect?: boolean;
  heartbeatIntervalMs?: number;
  quoteSources?: {
    oneInch?: {
      enabled: boolean;
      apiKey?: string;
    };
    paraSwap?: {
      enabled: boolean;
      apiKey?: string;
    };
    uniswapV3?: {
      enabled: boolean;
    };
  };
}

export interface Quote {
  amountOut: bigint;
  route: string[];
  gasEstimate: bigint;
  source: string;
}

export interface QuoteSource {
  name: string;
  getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote>;
}

export interface SolverMetrics {
  totalBids: number;
  wonBids: number;
  winRate: number;
  averageResponseTime: number;
  totalVolume: string;
}

export interface WebSocketMessage {
  type: 'IntentCreated' | 'IntentExpired';
  data: any;
}

export interface BidSubmissionResult {
  success: boolean;
  error?: string;
  bidId?: string;
}

export interface SolverEvents {
  starting: [];
  started: [];
  stopping: [];
  stopped: [];
  connected: [];
  disconnected: [];
  reconnecting: [];
  error: [Error];
  intentReceived: [Intent];
  bidSubmitted: [{ intent: Intent; bid: BidResponse; result: BidSubmissionResult }];
  bidFailed: [{ intent: Intent; bid: BidResponse; error?: string }];
  noBid: [Intent];
  quoteFetched: [{ source: string; quote: Quote }];
  quoteError: [{ source: string; error: string }];
}

export type IntentHandler = (intent: Intent) => Promise<BidResponse | null>;

// Authentication types
export interface AuthConfig {
  solverPrivateKey: string;
  coordinatorUrl: string;
}

export interface AuthToken {
  token: string;
  expiresAt: number;
}

// WebSocket types
export interface WebSocketConfig {
  wsUrl: string;
  enableAutoReconnect?: boolean;
  heartbeatIntervalMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

// Performance monitoring types
export interface PerformanceConfig {
  enablePerformanceMonitoring?: boolean;
}

export interface BidMetrics {
  timestamp: number;
  responseTime: number;
  success: boolean;
}