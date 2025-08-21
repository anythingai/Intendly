/**
 * @fileoverview Solver-related type definitions
 * @description Types for solver registry, management, and operations
 */

// ============================================================================
// Core Solver Types
// ============================================================================

/**
 * Solver registry information
 */
export interface SolverInfo {
  solverId: string;
  pubkey: string;
  metadata: SolverMetadata;
  isAllowed: boolean;
  registeredAt: Date;
  lastActiveAt?: Date;
  totalBids: number;
  wonBids: number;
  winRate: number;
  reputation: number; // 0-100 score
  averageResponseTime: number; // milliseconds
  totalVolume: string; // in wei
}

/**
 * Solver metadata and configuration
 */
export interface SolverMetadata {
  name?: string;
  description?: string;
  website?: string;
  contact?: string;
  strategy?: SolverStrategy;
  version?: string;
  supportedChains?: number[];
  supportedTokens?: string[];
  maxPositionSize?: string;
  avgGasUsage?: number;
  specializations?: string[]; // e.g., ['stablecoins', 'large-orders']
}

/**
 * Solver strategy classification
 */
export enum SolverStrategy {
  SPEED = 'speed',           // Optimized for fast responses
  PROFIT = 'profit',         // Optimized for maximum profit
  BALANCED = 'balanced',     // Balance of speed and profit
  CONSERVATIVE = 'conservative', // Lower risk, stable returns
  AGGRESSIVE = 'aggressive', // Higher risk, higher returns
  ARBITRAGE = 'arbitrage',   // Cross-DEX arbitrage focused
  MARKET_MAKER = 'market_maker', // Market making strategies
  CUSTOM = 'custom'          // Custom strategy
}

/**
 * Solver configuration for SDK
 */
export interface SolverConfig {
  solverPrivateKey: string;
  solverId?: string; // Derived from private key if not provided
  coordinatorUrl: string;
  wsUrl: string;
  chainId: number;
  rpcUrl?: string;
  settlementContract?: string;
  strategy?: SolverStrategy;
  metadata?: Partial<SolverMetadata>;
}

// ============================================================================
// Solver Performance and Analytics
// ============================================================================

/**
 * Detailed solver performance metrics
 */
export interface SolverPerformanceMetrics {
  solverId: string;
  timeframe: {
    start: Date;
    end: Date;
  };
  
  // Bidding metrics
  totalBids: number;
  acceptedBids: number;
  rejectedBids: number;
  wonBids: number;
  lostBids: number;
  
  // Performance metrics
  winRate: number; // percentage
  acceptanceRate: number; // percentage
  averageResponseTime: number; // milliseconds
  medianResponseTime: number;
  p95ResponseTime: number;
  
  // Economic metrics
  totalVolume: string; // in wei
  totalFees: string; // in wei
  averageFee: number; // basis points
  profitMargin: number; // percentage
  
  // Quality metrics
  reputation: number; // 0-100 score
  reliability: number; // uptime percentage
  errorRate: number; // percentage
  
  // Competition metrics
  marketShare: number; // percentage of total volume
  competitionRank: number;
  priceCompetitiveness: number; // vs market average
}

/**
 * Solver leaderboard entry
 */
export interface SolverLeaderboardEntry {
  rank: number;
  solverId: string;
  name?: string;
  winRate: number;
  totalVolume: string;
  reputation: number;
  badge?: SolverBadge;
  changeFromLastPeriod: number; // rank change
}

/**
 * Solver achievement badges
 */
export enum SolverBadge {
  TOP_PERFORMER = 'top_performer',
  SPEED_DEMON = 'speed_demon',
  PROFIT_MAXIMIZER = 'profit_maximizer',
  RELIABLE = 'reliable',
  NEWCOMER = 'newcomer',
  VETERAN = 'veteran',
  SPECIALIST = 'specialist'
}

// ============================================================================
// Solver Registration and Management
// ============================================================================

/**
 * Solver registration request
 */
export interface SolverRegistrationRequest {
  solverId: string;
  pubkey: string;
  metadata: SolverMetadata;
  signature: string; // Signature proving control of private key
  stake?: string; // Optional stake amount
}

/**
 * Solver registration response
 */
export interface SolverRegistrationResponse {
  success: boolean;
  solverId: string;
  registrationId?: string;
  error?: string;
  requiresApproval?: boolean;
  estimatedApprovalTime?: string;
}

/**
 * Solver status update
 */
export interface SolverStatusUpdate {
  solverId: string;
  isActive: boolean;
  metadata?: Partial<SolverMetadata>;
  signature: string;
}

// ============================================================================
// Solver Operations and Quotes
// ============================================================================

/**
 * Quote request from solver
 */
export interface QuoteRequest {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps?: number;
  deadline?: number;
  preferences?: QuotePreferences;
}

/**
 * Quote preferences and constraints
 */
export interface QuotePreferences {
  maxHops?: number;
  preferredDEXs?: string[];
  excludedDEXs?: string[];
  maxGasPrice?: string;
  optimizeFor?: 'speed' | 'price' | 'gas';
}

/**
 * Quote response from aggregator
 */
export interface Quote {
  amountOut: string;
  route: string[]; // Token addresses in route
  pools: string[]; // Pool addresses used
  dexes: string[]; // DEX names used
  gasEstimate: string;
  priceImpact: number; // basis points
  source: string; // Quote source identifier
  confidence: number; // 0-100 confidence score
  timestamp: number;
  expiresAt?: number;
}

/**
 * Quote source interface for solver implementations
 */
export interface QuoteSource {
  name: string;
  supportedChains: number[];
  
  getQuote(request: QuoteRequest): Promise<Quote>;
  isHealthy(): Promise<boolean>;
  getMetadata(): QuoteSourceMetadata;
}

/**
 * Quote source metadata
 */
export interface QuoteSourceMetadata {
  name: string;
  version: string;
  supportedDEXs: string[];
  averageLatency: number;
  reliability: number; // 0-100 score
  lastUpdated: Date;
}

// ============================================================================
// Solver Risk Management
// ============================================================================

/**
 * Risk management configuration
 */
export interface RiskConfig {
  maxPositionSize: string; // in wei
  maxDailyVolume: string; // in wei  
  maxConcurrentOrders: number;
  minProfitBps: number;
  maxSlippageBps: number;
  blacklistedTokens: string[];
  whitelistedTokens?: string[];
  maxGasPrice: string; // in wei
  emergencyStopEnabled: boolean;
}

/**
 * Risk assessment result
 */
export interface RiskAssessment {
  approved: boolean;
  riskScore: number; // 0-100, higher is riskier
  concerns: string[];
  recommendations: string[];
  limits: {
    maxAmount?: string;
    requiresManualApproval?: boolean;
  };
}

// ============================================================================
// Solver Events and Notifications
// ============================================================================

export type SolverEvent = 
  | SolverRegisteredEvent
  | SolverStatusChangedEvent
  | SolverPerformanceUpdateEvent
  | SolverPenaltyEvent
  | SolverRewardEvent;

export interface SolverRegisteredEvent {
  type: 'SolverRegistered';
  solverId: string;
  metadata: SolverMetadata;
  timestamp: string;
}

export interface SolverStatusChangedEvent {
  type: 'SolverStatusChanged';
  solverId: string;
  oldStatus: boolean;
  newStatus: boolean;
  reason?: string;
  timestamp: string;
}

export interface SolverPerformanceUpdateEvent {
  type: 'SolverPerformanceUpdate';
  solverId: string;
  metrics: Partial<SolverPerformanceMetrics>;
  timestamp: string;
}

export interface SolverPenaltyEvent {
  type: 'SolverPenalty';
  solverId: string;
  penaltyType: 'timeout' | 'invalid_bid' | 'failed_execution';
  severity: 'warning' | 'minor' | 'major' | 'critical';
  details: string;
  timestamp: string;
}

export interface SolverRewardEvent {
  type: 'SolverReward';
  solverId: string;
  rewardType: 'performance_bonus' | 'volume_milestone' | 'consistency_reward';
  amount: string;
  details: string;
  timestamp: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Solver ID type for better type safety
 */
export type SolverId = string & { readonly brand: unique symbol };

/**
 * Helper to create typed solver ID
 */
export const createSolverId = (id: string): SolverId => id as SolverId;

/**
 * Solver registry query filters
 */
export interface SolverQuery {
  isActive?: boolean;
  strategy?: SolverStrategy;
  minReputation?: number;
  supportedChain?: number;
  supportedToken?: string;
  minVolume?: string;
  maxResponseTime?: number;
}

/**
 * Solver comparison data
 */
export interface SolverComparison {
  solvers: SolverLeaderboardEntry[];
  metrics: string[]; // Which metrics to compare
  timeframe: {
    start: Date;
    end: Date;
  };
  summary: {
    topPerformer: string;
    mostImproved: string;
    highestVolume: string;
    fastestResponse: string;
  };
}