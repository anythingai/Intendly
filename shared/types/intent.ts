/**
 * @fileoverview Intent-related type definitions
 * @description Core types for intent structures and processing
 */

// ============================================================================
// Core Intent Types
// ============================================================================

/**
 * Core intent structure matching the smart contract Intent struct
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

/**
 * Simplified intent summary for API responses
 */
export interface IntentSummary {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: string;
  receiver: string;
}

/**
 * Intent with signature for submission
 */
export interface SignedIntent {
  intent: Intent;
  signature: string;
  intentHash: string;
}

/**
 * Database record for intent persistence
 */
export interface IntentRecord {
  intentHash: string;
  payload: Intent;
  signature: string;
  signer: string;
  status: IntentStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  totalBids?: number;
  bestBid?: string; // JSON serialized BidLike
}

// ============================================================================
// Intent Status and Lifecycle
// ============================================================================

/**
 * Intent lifecycle status
 */
export enum IntentStatus {
  NEW = 'NEW',
  BROADCASTING = 'BROADCASTING',
  BIDDING = 'BIDDING',
  FILLED = 'FILLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

/**
 * Intent validation result
 */
export interface IntentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Intent processing metrics
 */
export interface IntentMetrics {
  totalIntents: number;
  filledIntents: number;
  expiredIntents: number;
  failedIntents: number;
  averageTimeToFirstBid: number;
  averageTimeToSettle: number;
  averagePriceImprovement: number; // in basis points
}

// ============================================================================
// EIP-712 Types
// ============================================================================

/**
 * EIP-712 domain for intent signing
 */
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

/**
 * EIP-712 typed data structure for Intent
 */
export interface IntentTypedData {
  domain: EIP712Domain;
  types: {
    Intent: Array<{
      name: string;
      type: string;
    }>;
  };
  primaryType: 'Intent';
  message: Intent;
}

/**
 * EIP-712 type definitions for Intent struct
 */
export const INTENT_EIP712_TYPES = {
  Intent: [
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'maxSlippageBps', type: 'uint16' },
    { name: 'deadline', type: 'uint64' },
    { name: 'chainId', type: 'uint256' },
    { name: 'receiver', type: 'address' },
    { name: 'nonce', type: 'uint256' }
  ]
} as const;

/**
 * Default EIP-712 domain for Intent signing
 */
export const INTENT_DOMAIN: EIP712Domain = {
  name: 'IntentSwap',
  version: '1',
  chainId: 196, // X Layer - will be configurable
  verifyingContract: '0x0000000000000000000000000000000000000000' // To be updated
};

// ============================================================================
// Intent Form and UI Types
// ============================================================================

/**
 * Form data for intent creation
 */
export interface IntentFormData {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline?: number; // Optional, defaults to 1 hour
  receiver?: string; // Optional, defaults to connected wallet
}

/**
 * Intent creation request
 */
export interface CreateIntentRequest {
  intent: Intent;
  signature: string;
}

/**
 * Intent creation response
 */
export interface CreateIntentResponse {
  intentHash: string;
  biddingWindowMs: number;
  expiresAt: string;
  status: 'success' | 'error';
  message?: string;
}

/**
 * Intent query parameters
 */
export interface IntentQuery {
  hash?: string;
  signer?: string;
  status?: IntentStatus;
  tokenIn?: string;
  tokenOut?: string;
  minAmount?: string;
  maxAmount?: string;
  fromDate?: string;
  toDate?: string;
}

// ============================================================================
// Intent Events and Notifications
// ============================================================================

/**
 * Intent lifecycle events
 */
export type IntentEvent = 
  | IntentCreatedEvent
  | IntentUpdatedEvent
  | IntentFilledEvent
  | IntentExpiredEvent
  | IntentFailedEvent;

export interface IntentCreatedEvent {
  type: 'IntentCreated';
  intentHash: string;
  intent: IntentSummary;
  timestamp: string;
}

export interface IntentUpdatedEvent {
  type: 'IntentUpdated';
  intentHash: string;
  status: IntentStatus;
  timestamp: string;
}

export interface IntentFilledEvent {
  type: 'IntentFilled';
  intentHash: string;
  txHash: string;
  amountOut: string;
  solverFeePaid: string;
  timestamp: string;
}

export interface IntentExpiredEvent {
  type: 'IntentExpired';
  intentHash: string;
  reason: string;
  timestamp: string;
}

export interface IntentFailedEvent {
  type: 'IntentFailed';
  intentHash: string;
  error: string;
  timestamp: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Intent hash type for better type safety
 */
export type IntentHash = string & { readonly brand: unique symbol };

/**
 * Helper to create typed intent hash
 */
export const createIntentHash = (hash: string): IntentHash => hash as IntentHash;

/**
 * Intent with computed fields
 */
export interface EnrichedIntent extends Intent {
  hash: IntentHash;
  isExpired: boolean;
  timeToExpiry: number;
  estimatedGasUsage?: string;
  expectedOutput?: string;
}