/**
 * @fileoverview Intent-related type definitions
 * @description Core types for intent structures and processing
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

export interface IntentSummary {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
  deadline: string;
  receiver: string;
}

export interface SignedIntent {
  intent: Intent;
  signature: string;
  intentHash: string;
}

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
  bestBid?: string;
}

export enum IntentStatus {
  NEW = 'NEW',
  BROADCASTING = 'BROADCASTING',
  BIDDING = 'BIDDING',
  FILLED = 'FILLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface IntentValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface IntentMetrics {
  totalIntents: number;
  filledIntents: number;
  expiredIntents: number;
  averageTimeToFirstBid: number;
  averageTimeToSettle: number;
}

// EIP-712 domain for intent signing
export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
}

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

export const INTENT_DOMAIN: EIP712Domain = {
  name: 'IntentSwap',
  version: '1',
  chainId: 196, // X Layer
  verifyingContract: '0x0000000000000000000000000000000000000000' // To be updated
};

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