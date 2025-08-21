/**
 * @fileoverview Bid-related type definitions
 * @description Types for solver bids and bid processing
 */

export interface Bid {
  intentHash: string;
  solverId: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
  ttlMs: number;
  solverSig: string;
  arrivedAt: Date;
}

export interface BidLike {
  solver: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
}

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

export interface BidSubmission {
  intentHash: string;
  quoteOut: string;
  solverFeeBps: number;
  calldataHint: string;
  ttlMs: number;
  solverSig: string;
}

export interface BidResponse {
  accepted: boolean;
  rank?: number;
  error?: string;
  bidId?: string;
  score?: number;
}

export interface BestBidResponse {
  bid: BidLike | null;
  totalBids: number;
  windowClosesAt: string;
  score?: number;
  improvement?: string; // basis points improvement over baseline
}

export interface BidMetrics {
  totalBids: number;
  averageBidsPerIntent: number;
  averageSolverFee: number;
  solverWinRates: Record<string, number>;
  averageResponseTime: number;
}

export interface SolverInfo {
  solverId: string;
  pubkey: string;
  metadata: SolverMetadata;
  isAllowed: boolean;
  registeredAt: Date;
  totalBids: number;
  wonBids: number;
  winRate: number;
}

export interface SolverMetadata {
  name?: string;
  description?: string;
  website?: string;
  strategy?: string;
  version?: string;
  supportedChains?: number[];
  supportedTokens?: string[];
}

export enum BidStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
  WON = 'WON',
  LOST = 'LOST',
  INVALID = 'INVALID'
}

export interface BidValidationResult {
  isValid: boolean;
  errors: string[];
}

// Scoring configuration
export interface BidScoringConfig {
  feeWeight: number; // Weight for solver fee in scoring
  speedWeight: number; // Weight for bid arrival time
  reputationWeight: number; // Weight for solver reputation
  outputWeight: number; // Weight for quote output amount
}

export const DEFAULT_BID_SCORING: BidScoringConfig = {
  feeWeight: 0.3,
  speedWeight: 0.2,
  reputationWeight: 0.2,
  outputWeight: 0.3
};