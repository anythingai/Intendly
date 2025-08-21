/**
 * @fileoverview Bid-related type definitions
 * @description Types for solver bids and bid processing
 */

import { IntentHash } from './intent.js';

// ============================================================================
// Core Bid Types
// ============================================================================

/**
 * Bid structure matching the smart contract BidLike struct
 */
export interface BidLike {
  solver: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
}

/**
 * Complete bid with metadata for database storage
 */
export interface Bid {
  intentHash: IntentHash;
  solverId: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
  ttlMs: number;
  solverSig: string;
  arrivedAt: Date;
  rank?: number;
  score?: number;
}

/**
 * Bid submission payload from solver
 */
export interface BidSubmission {
  intentHash: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
  ttlMs: number;
  solverSig: string;
}

/**
 * Bid submission response
 */
export interface BidResponse {
  accepted: boolean;
  rank?: number;
  error?: string;
  bidId?: string;
  score?: number;
}

/**
 * Database record for bid persistence
 */
export interface BidRecord {
  id: string;
  intentHash: string;
  solverId: string;
  quoteOut: string;
  solverFeeBps: number;
  payloadUri?: string;
  arrivedAt: Date;
  solverSignature: string;
  rank?: number;
  score?: number;
  status: BidStatus;
}

// ============================================================================
// Bid Status and Lifecycle
// ============================================================================

/**
 * Bid lifecycle status
 */
export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WON = 'WON',
  LOST = 'LOST',
  INVALID = 'INVALID'
}

/**
 * Bid validation result
 */
export interface BidValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ============================================================================
// Bid Responses and API Types
// ============================================================================

/**
 * Best bid response for an intent
 */
export interface BestBidResponse {
  bid: BidLike | null;
  totalBids: number;
  windowClosesAt: string;
  score?: number;
  improvement?: string; // basis points improvement over baseline
  ranking?: BidRanking[];
}

/**
 * Bid ranking information
 */
export interface BidRanking {
  rank: number;
  solverId: string;
  quoteOut: string;
  solverFeeBps: number;
  score: number;
  effectiveOutput: string; // quoteOut minus fees
}

/**
 * Bid comparison data
 */
export interface BidComparison {
  bestBid: BidLike;
  alternatives: BidRanking[];
  priceImprovement: string; // vs. direct DEX quote
  savingsAmount: string; // absolute savings
  savingsPercentage: number; // percentage savings
}

// ============================================================================
// Bid Scoring and Selection
// ============================================================================

/**
 * Bid scoring configuration
 */
export interface BidScoringConfig {
  feeWeight: number; // Weight for solver fee in scoring (0-1)
  speedWeight: number; // Weight for bid arrival time (0-1)
  reputationWeight: number; // Weight for solver reputation (0-1)
  outputWeight: number; // Weight for quote output amount (0-1)
  gasWeight: number; // Weight for gas efficiency (0-1)
}

/**
 * Default bid scoring weights
 */
export const DEFAULT_BID_SCORING: BidScoringConfig = {
  feeWeight: 0.3,
  speedWeight: 0.2,
  reputationWeight: 0.2,
  outputWeight: 0.25,
  gasWeight: 0.05
};

/**
 * Bid scoring result
 */
export interface BidScore {
  totalScore: number;
  components: {
    feeScore: number;
    speedScore: number;
    reputationScore: number;
    outputScore: number;
    gasScore: number;
  };
  effectiveOutput: string; // quoteOut minus fees
  rank: number;
}

// ============================================================================
// Bid Metrics and Analytics
// ============================================================================

/**
 * Bid metrics for analytics
 */
export interface BidMetrics {
  totalBids: number;
  averageBidsPerIntent: number;
  averageSolverFee: number; // in basis points
  averageResponseTime: number; // in milliseconds
  winRateByFee: Record<string, number>; // fee tier -> win rate
  solverPerformance: SolverPerformance[];
}

/**
 * Individual solver performance metrics
 */
export interface SolverPerformance {
  solverId: string;
  totalBids: number;
  wonBids: number;
  winRate: number;
  averageFee: number; // basis points
  averageResponseTime: number; // milliseconds
  totalVolume: string;
  reputation: number; // 0-100 score
}

/**
 * Market analysis data
 */
export interface MarketAnalysis {
  averageSpread: number; // basis points
  competitionLevel: number; // number of active solvers
  priceImprovementTrend: number[]; // historical improvement
  volumeDistribution: Record<string, number>; // solver -> volume %
  timeOfDayPatterns: Record<string, number>; // hour -> activity level
}

// ============================================================================
// Bid Events and Notifications
// ============================================================================

export type BidEvent = 
  | BidReceivedEvent
  | BidAcceptedEvent
  | BidRejectedEvent
  | BestBidUpdatedEvent
  | BidExpiredEvent;

export interface BidReceivedEvent {
  type: 'BidReceived';
  intentHash: string;
  solverId: string;
  quoteOut: string;
  solverFeeBps: number;
  rank: number;
  timestamp: string;
}

export interface BidAcceptedEvent {
  type: 'BidAccepted';
  intentHash: string;
  solverId: string;
  bidId: string;
  timestamp: string;
}

export interface BidRejectedEvent {
  type: 'BidRejected';
  intentHash: string;
  solverId: string;
  bidId: string;
  reason: string;
  timestamp: string;
}

export interface BestBidUpdatedEvent {
  type: 'BestBidUpdated';
  intentHash: string;
  bestBid: BidLike;
  score: number;
  improvement: string; // bps vs baseline
  timestamp: string;
}

export interface BidExpiredEvent {
  type: 'BidExpired';
  intentHash: string;
  solverId: string;
  bidId: string;
  timestamp: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Bid hash type for better type safety
 */
export type BidHash = string & { readonly brand: unique symbol };

/**
 * Helper to create typed bid hash
 */
export const createBidHash = (hash: string): BidHash => hash as BidHash;

/**
 * Bid with computed fields
 */
export interface EnrichedBid extends Bid {
  hash: BidHash;
  isExpired: boolean;
  timeToExpiry: number;
  effectiveOutput: string; // after fees
  gasEstimate?: string;
  confidence?: number; // 0-100 confidence score
}

/**
 * Bid aggregation summary
 */
export interface BidSummary {
  intentHash: string;
  totalBids: number;
  bestQuote: string;
  worstQuote: string;
  averageQuote: string;
  medianQuote: string;
  spreadBps: number; // best - worst in bps
  competitionIndex: number; // measure of competition intensity
}