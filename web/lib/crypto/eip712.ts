/**
 * @fileoverview EIP-712 signing utilities for intent signatures
 * @description Handles intent signing with EIP-712 structured data
 */

import { Address, TypedData } from 'viem';
import { Intent, INTENT_EIP712_TYPES, INTENT_DOMAIN } from '../../types/index.js';

// ============================================================================
// EIP-712 Domain Configuration
// ============================================================================

export interface EIP712Domain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: Address;
}

export const createIntentDomain = (chainId: number, contractAddress: Address): EIP712Domain => ({
  name: INTENT_DOMAIN.name,
  version: INTENT_DOMAIN.version,
  chainId,
  verifyingContract: contractAddress
});

// ============================================================================
// Intent Signing Types
// ============================================================================

export interface IntentTypedData {
  domain: EIP712Domain;
  types: typeof INTENT_EIP712_TYPES;
  primaryType: 'Intent';
  message: Intent;
}

export interface SignIntentParams {
  intent: Intent;
  chainId: number;
  contractAddress: Address;
}

export interface SignIntentResult {
  signature: `0x${string}`;
  typedData: IntentTypedData;
  intentHash: `0x${string}`;
}

// ============================================================================
// Intent Hash Calculation
// ============================================================================

/**
 * Calculate the EIP-712 hash for an intent
 * @param typedData The structured data to hash
 * @returns The EIP-712 hash
 */
export const calculateIntentHash = (typedData: IntentTypedData): `0x${string}` => {
  // This would typically use viem's hashTypedData function
  // For now, we'll return a placeholder that would be computed by viem
  return '0x' as `0x${string}`;
};

/**
 * Create the structured data for intent signing
 * @param params Parameters for intent signing
 * @returns The typed data structure
 */
export const createIntentTypedData = (params: SignIntentParams): IntentTypedData => {
  const { intent, chainId, contractAddress } = params;
  
  const domain = createIntentDomain(chainId, contractAddress);
  
  return {
    domain,
    types: INTENT_EIP712_TYPES,
    primaryType: 'Intent',
    message: intent
  };
};

// ============================================================================
// Intent Validation
// ============================================================================

/**
 * Validate intent structure before signing
 * @param intent The intent to validate
 * @returns Validation result
 */
export const validateIntentForSigning = (intent: Intent): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Check required fields
  if (!intent.tokenIn || intent.tokenIn === '0x0000000000000000000000000000000000000000') {
    errors.push('tokenIn is required and must be a valid address');
  }
  
  if (!intent.tokenOut || intent.tokenOut === '0x0000000000000000000000000000000000000000') {
    errors.push('tokenOut is required and must be a valid address');
  }
  
  if (intent.tokenIn === intent.tokenOut) {
    errors.push('tokenIn and tokenOut cannot be the same');
  }
  
  if (!intent.amountIn || BigInt(intent.amountIn) <= 0n) {
    errors.push('amountIn must be greater than 0');
  }
  
  if (intent.maxSlippageBps < 0 || intent.maxSlippageBps > 1000) { // Max 10%
    errors.push('maxSlippageBps must be between 0 and 1000 (10%)');
  }
  
  const deadline = BigInt(intent.deadline);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline <= now) {
    errors.push('deadline must be in the future');
  }
  
  if (!intent.chainId || BigInt(intent.chainId) <= 0n) {
    errors.push('chainId is required and must be positive');
  }
  
  if (!intent.receiver || intent.receiver === '0x0000000000000000000000000000000000000000') {
    errors.push('receiver is required and must be a valid address');
  }
  
  if (!intent.nonce || BigInt(intent.nonce) < 0n) {
    errors.push('nonce is required and must be non-negative');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// ============================================================================
// Nonce Management
// ============================================================================

/**
 * Generate a unique nonce for intent signing
 * @param userAddress User's wallet address
 * @returns A unique nonce
 */
export const generateIntentNonce = (userAddress: Address): string => {
  // Combine timestamp with a random component and user address hash
  const timestamp = Math.floor(Date.now() / 1000);
  const random = Math.floor(Math.random() * 1000000);
  const addressSuffix = parseInt(userAddress.slice(-6), 16);
  
  return `${timestamp}${random}${addressSuffix}`;
};

/**
 * Check if a nonce has been used (would query the smart contract)
 * @param userAddress User's wallet address
 * @param nonce The nonce to check
 * @returns Promise resolving to whether the nonce is used
 */
export const isNonceUsed = async (userAddress: Address, nonce: string): Promise<boolean> => {
  // This would query the smart contract's usedNonces mapping
  // For now, return false as a placeholder
  return false;
};

// ============================================================================
// Signature Validation
// ============================================================================

/**
 * Validate an EIP-712 signature for an intent
 * @param signature The signature to validate
 * @param typedData The typed data that was signed
 * @param signerAddress The expected signer address
 * @returns Whether the signature is valid
 */
export const validateIntentSignature = async (
  signature: `0x${string}`,
  typedData: IntentTypedData,
  signerAddress: Address
): Promise<boolean> => {
  try {
    // This would use viem's verifyTypedData function
    // For now, return true as a placeholder
    return true;
  } catch (error) {
    console.error('Signature validation error:', error);
    return false;
  }
};

// ============================================================================
// Intent Deadline Utilities
// ============================================================================

/**
 * Calculate deadline timestamp from minutes
 * @param minutes Minutes from now
 * @returns Unix timestamp
 */
export const calculateDeadline = (minutes: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const deadline = now + (minutes * 60);
  return deadline.toString();
};

/**
 * Get default deadline (1 hour from now)
 * @returns Default deadline timestamp
 */
export const getDefaultDeadline = (): string => {
  return calculateDeadline(60); // 1 hour
};

/**
 * Check if an intent has expired
 * @param deadline Intent deadline timestamp
 * @returns Whether the intent has expired
 */
export const isIntentExpired = (deadline: string): boolean => {
  const now = Math.floor(Date.now() / 1000);
  return BigInt(deadline) <= BigInt(now);
};

/**
 * Get time remaining for an intent
 * @param deadline Intent deadline timestamp
 * @returns Seconds remaining (0 if expired)
 */
export const getTimeRemaining = (deadline: string): number => {
  const now = Math.floor(Date.now() / 1000);
  const remaining = Number(BigInt(deadline)) - now;
  return Math.max(0, remaining);
};

// ============================================================================
// Intent Serialization
// ============================================================================

/**
 * Serialize intent for consistent hashing
 * @param intent The intent to serialize
 * @returns Serialized intent data
 */
export const serializeIntent = (intent: Intent): string => {
  return JSON.stringify({
    tokenIn: intent.tokenIn.toLowerCase(),
    tokenOut: intent.tokenOut.toLowerCase(),
    amountIn: intent.amountIn,
    maxSlippageBps: intent.maxSlippageBps,
    deadline: intent.deadline,
    chainId: intent.chainId,
    receiver: intent.receiver.toLowerCase(),
    nonce: intent.nonce
  });
};

/**
 * Create a deterministic intent ID
 * @param intent The intent to create ID for
 * @returns A deterministic intent ID
 */
export const createIntentId = (intent: Intent): string => {
  const serialized = serializeIntent(intent);
  // This would use a hash function like keccak256
  // For now, return a placeholder
  return `intent_${Date.now()}`;
};

// ============================================================================
// Error Types
// ============================================================================

export class IntentSigningError extends Error {
  constructor(message: string, public code: string, public details?: any) {
    super(message);
    this.name = 'IntentSigningError';
  }
}

export class InvalidIntentError extends IntentSigningError {
  constructor(errors: string[]) {
    super(`Invalid intent: ${errors.join(', ')}`, 'INVALID_INTENT', { errors });
  }
}

export class SignatureValidationError extends IntentSigningError {
  constructor(message: string = 'Signature validation failed') {
    super(message, 'SIGNATURE_VALIDATION_ERROR');
  }
}

export class NonceAlreadyUsedError extends IntentSigningError {
  constructor(nonce: string) {
    super(`Nonce ${nonce} has already been used`, 'NONCE_ALREADY_USED', { nonce });
  }
}

// ============================================================================
// Utility Constants
// ============================================================================

export const EIP712_CONSTANTS = {
  // Maximum allowed slippage (10%)
  MAX_SLIPPAGE_BPS: 1000,
  
  // Maximum deadline (24 hours)
  MAX_DEADLINE_HOURS: 24,
  
  // Minimum deadline (5 minutes)
  MIN_DEADLINE_MINUTES: 5,
  
  // Default deadline (1 hour)
  DEFAULT_DEADLINE_MINUTES: 60
} as const;