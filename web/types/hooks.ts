/**
 * @fileoverview Hook-related type definitions
 * @description Types for custom React hooks and their return values
 */

import { Intent, BidLike, IntentStatus, BestBidResponse } from './index.js';

// ============================================================================
// Intent Hook Types
// ============================================================================

export interface UseIntentFlowReturn {
  // Current state
  currentIntent: Intent | null;
  intentHash: string | null;
  status: IntentStatus;
  
  // Actions
  createIntent: (formData: IntentFormData) => Promise<string>;
  cancelIntent: () => void;
  reset: () => void;
  
  // Loading states
  isCreating: boolean;
  isLoading: boolean;
  
  // Error handling
  error: string | null;
  clearError: () => void;
}

export interface UseIntentStatusReturn {
  status: IntentStatus;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// Bid Hook Types
// ============================================================================

export interface UseIntentBidsReturn {
  // Bid data
  bids: BidLike[];
  bestBid: BidLike | null;
  totalBids: number;
  
  // Competition metrics
  priceImprovement: string | null;
  savingsAmount: string | null;
  competitionLevel: number;
  
  // Window state
  biddingWindowOpen: boolean;
  windowClosesAt: Date | null;
  timeRemaining: number | null;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
}

export interface UseBidComparisonReturn {
  bestBid: BidLike | null;
  alternatives: BidLike[];
  priceImprovement: string | null;
  savingsPercentage: number | null;
  recommendedBid: BidLike | null;
  competitionMetrics: {
    totalSolvers: number;
    spreadBps: number;
    averageResponseTime: number;
  };
}

// ============================================================================
// WebSocket Hook Types
// ============================================================================

export interface UseWebSocketReturn {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  
  // Event handling
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  
  // Connection stats
  lastHeartbeat: number | null;
  connectionTime: number | null;
  reconnectAttempts: number;
}

export interface UseRealtimeUpdatesReturn {
  // Real-time data
  liveIntents: Intent[];
  liveBids: Record<string, BidLike[]>;
  marketActivity: MarketActivity;
  
  // Subscription management
  subscribeToIntent: (intentHash: string) => void;
  unsubscribeFromIntent: (intentHash: string) => void;
  
  // Connection state
  isConnected: boolean;
  lastUpdate: number | null;
}

// ============================================================================
// Token Hook Types
// ============================================================================

export interface UseTokensReturn {
  tokens: TokenInfo[];
  popularTokens: TokenInfo[];
  isLoading: boolean;
  error: string | null;
  searchTokens: (query: string) => TokenInfo[];
  getTokenByAddress: (address: string) => TokenInfo | null;
  getTokenBySymbol: (symbol: string) => TokenInfo | null;
  refresh: () => Promise<void>;
}

export interface UseTokenBalancesReturn {
  balances: Record<string, TokenBalance>;
  isLoading: boolean;
  error: string | null;
  getBalance: (tokenAddress: string) => string;
  getFormattedBalance: (tokenAddress: string) => string;
  hasBalance: (tokenAddress: string, amount: string) => boolean;
  refresh: () => Promise<void>;
}

export interface TokenBalance {
  address: string;
  balance: string;
  decimals: number;
  symbol: string;
  formatted: string;
  usdValue?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  chainId: number;
  isNative?: boolean;
  isPopular?: boolean;
  tags?: string[];
}

// ============================================================================
// Transaction Hook Types
// ============================================================================

export interface UseTransactionReturn {
  // Transaction state
  hash: string | null;
  receipt: any | null;
  status: 'idle' | 'pending' | 'success' | 'error';
  
  // Actions
  sendTransaction: (txRequest: any) => Promise<string>;
  waitForReceipt: () => Promise<any>;
  reset: () => void;
  
  // Loading and error
  isLoading: boolean;
  error: string | null;
  
  // Gas estimation
  estimatedGas: string | null;
  gasPrice: string | null;
}

export interface UseContractWriteReturn {
  write: (args?: any[]) => Promise<string>;
  writeAsync: (args?: any[]) => Promise<string>;
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  data: string | null;
  reset: () => void;
}

// ============================================================================
// Performance Hook Types
// ============================================================================

export interface UsePerformanceMetricsReturn {
  metrics: PerformanceMetrics;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export interface PerformanceMetrics {
  totalVolume: string;
  totalTrades: number;
  averageSavings: string;
  averageExecutionTime: number;
  successRate: number;
  topSolvers: SolverMetrics[];
  priceImprovementTrend: number[];
}

export interface SolverMetrics {
  id: string;
  name: string;
  volume: string;
  trades: number;
  successRate: number;
  averageFee: number;
  reputation: number;
}

// ============================================================================
// Form Hook Types
// ============================================================================

export interface UseFormReturn<T> {
  values: T;
  errors: Record<keyof T, string>;
  touched: Record<keyof T, boolean>;
  isValid: boolean;
  isSubmitting: boolean;
  
  setValue: (field: keyof T, value: any) => void;
  setValues: (values: Partial<T>) => void;
  setError: (field: keyof T, error: string) => void;
  clearError: (field: keyof T) => void;
  resetForm: () => void;
  handleSubmit: (onSubmit: (values: T) => Promise<void> | void) => (e?: any) => void;
}

export interface IntentFormData {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: number;
  receiver?: string;
}

// ============================================================================
// Analytics Hook Types
// ============================================================================

export interface UseAnalyticsReturn {
  track: (event: string, properties?: Record<string, any>) => void;
  page: (name: string, properties?: Record<string, any>) => void;
  identify: (userId: string, traits?: Record<string, any>) => void;
  reset: () => void;
}

// ============================================================================
// Helper Types
// ============================================================================

export interface MarketActivity {
  totalIntents: number;
  activeBidding: number;
  recentTrades: number;
  averageSpread: number;
  topPairs: string[];
}

export interface ConnectionMetrics {
  latency: number;
  uptime: number;
  messagesReceived: number;
  messagesSent: number;
  reconnections: number;
}