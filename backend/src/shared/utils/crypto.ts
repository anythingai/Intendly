/**
 * @fileoverview Cryptographic utilities for EIP-712 signature verification
 * @description Handles intent and bid signature validation using EIP-712 standard
 */

import { verifyTypedData, getAddress, isAddress } from 'viem';
import { INTENT_EIP712_TYPES, INTENT_DOMAIN, Intent } from '@/types/intent.js';
import { BidSubmission } from '@/types/bid.js';
import config from '../config/index.js';

/**
 * EIP-712 domain for bid signing
 */
const BID_DOMAIN = {
  name: 'IntentBidding',
  version: '1',
  chainId: config.blockchain.chainId,
  verifyingContract: config.blockchain.settlementContract,
};

/**
 * EIP-712 types for bid submission
 */
const BID_EIP712_TYPES = {
  Bid: [
    { name: 'intentHash', type: 'bytes32' },
    { name: 'quoteOut', type: 'uint256' },
    { name: 'solverFeeBps', type: 'uint16' },
    { name: 'calldataHint', type: 'bytes' },
    { name: 'ttlMs', type: 'uint32' }
  ]
} as const;

export class CryptoUtils {
  /**
   * Verify EIP-712 signature for an intent
   */
  static async verifyIntentSignature(
    intent: Intent,
    signature: `0x${string}`,
    expectedSigner: string
  ): Promise<boolean> {
    try {
      // Validate addresses
      if (!isAddress(expectedSigner)) {
        throw new Error('Invalid signer address');
      }

      if (!isAddress(intent.tokenIn) || !isAddress(intent.tokenOut)) {
        throw new Error('Invalid token addresses');
      }

      if (!isAddress(intent.receiver)) {
        throw new Error('Invalid receiver address');
      }

      // Update domain with current chain configuration
      const domain = {
        ...INTENT_DOMAIN,
        chainId: config.blockchain.chainId,
        verifyingContract: config.blockchain.settlementContract,
      };

      // Verify signature
      const isValid = await verifyTypedData({
        address: getAddress(expectedSigner),
        domain,
        types: INTENT_EIP712_TYPES,
        primaryType: 'Intent',
        message: intent,
        signature,
      });

      return isValid;
    } catch (error) {
      console.error('Intent signature verification failed:', error);
      return false;
    }
  }

  /**
   * Verify EIP-712 signature for a bid
   */
  static async verifyBidSignature(
    bid: BidSubmission,
    signature: `0x${string}`,
    solverAddress: string
  ): Promise<boolean> {
    try {
      // Validate solver address
      if (!isAddress(solverAddress)) {
        throw new Error('Invalid solver address');
      }

      // Prepare message for signing (excluding signature)
      const message = {
        intentHash: bid.intentHash as `0x${string}`,
        quoteOut: BigInt(bid.quoteOut),
        solverFeeBps: bid.solverFeeBps,
        calldataHint: bid.calldataHint as `0x${string}`,
        ttlMs: bid.ttlMs,
      };

      // Verify signature
      const isValid = await verifyTypedData({
        address: getAddress(solverAddress),
        domain: BID_DOMAIN,
        types: BID_EIP712_TYPES,
        primaryType: 'Bid',
        message,
        signature,
      });

      return isValid;
    } catch (error) {
      console.error('Bid signature verification failed:', error);
      return false;
    }
  }

  /**
   * Generate intent hash for EIP-712 signing
   */
  static generateIntentHash(intent: Intent): string {
    // This would typically use a proper hash function
    // For now, using a simple concatenation approach
    const data = [
      intent.tokenIn,
      intent.tokenOut,
      intent.amountIn,
      intent.maxSlippageBps.toString(),
      intent.deadline,
      intent.chainId,
      intent.receiver,
      intent.nonce
    ].join('');

    // In a real implementation, you'd use keccak256 or similar
    return `0x${Buffer.from(data).toString('hex').slice(0, 64).padEnd(64, '0')}`;
  }

  /**
   * Validate Ethereum address format
   */
  static isValidAddress(address: string): boolean {
    return isAddress(address);
  }

  /**
   * Normalize Ethereum address (checksum)
   */
  static normalizeAddress(address: string): string {
    if (!isAddress(address)) {
      throw new Error(`Invalid address: ${address}`);
    }
    return getAddress(address);
  }

  /**
   * Validate signature format
   */
  static isValidSignature(signature: string): boolean {
    if (!signature.startsWith('0x')) {
      return false;
    }
    
    // Standard signature length: 65 bytes * 2 hex chars + 0x = 132 characters
    return signature.length === 132;
  }

  /**
   * Generate typed data hash for intent (for debugging/testing)
   */
  static getIntentTypedDataHash(intent: Intent): string {
    // This would generate the EIP-712 structured data hash
    // Implementation would depend on the crypto library used
    return this.generateIntentHash(intent);
  }

  /**
   * Validate intent structure
   */
  static validateIntentStructure(intent: Intent): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate addresses
    if (!this.isValidAddress(intent.tokenIn)) {
      errors.push('Invalid tokenIn address');
    }

    if (!this.isValidAddress(intent.tokenOut)) {
      errors.push('Invalid tokenOut address');
    }

    if (!this.isValidAddress(intent.receiver)) {
      errors.push('Invalid receiver address');
    }

    // Validate amounts
    try {
      const amountIn = BigInt(intent.amountIn);
      if (amountIn <= 0n) {
        errors.push('Amount must be positive');
      }
    } catch {
      errors.push('Invalid amountIn format');
    }

    // Validate slippage
    if (intent.maxSlippageBps < 0 || intent.maxSlippageBps > 10000) {
      errors.push('Slippage must be between 0 and 10000 bps');
    }

    // Validate deadline
    try {
      const deadline = parseInt(intent.deadline);
      if (deadline <= Date.now() / 1000) {
        errors.push('Deadline must be in the future');
      }
    } catch {
      errors.push('Invalid deadline format');
    }

    // Validate chain ID
    if (intent.chainId !== config.blockchain.chainId.toString()) {
      errors.push(`Invalid chain ID: expected ${config.blockchain.chainId}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate bid structure
   */
  static validateBidStructure(bid: BidSubmission): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate intent hash format
    if (!bid.intentHash.startsWith('0x') || bid.intentHash.length !== 66) {
      errors.push('Invalid intent hash format');
    }

    // Validate quote amount
    try {
      const quoteOut = BigInt(bid.quoteOut);
      if (quoteOut <= 0n) {
        errors.push('Quote output must be positive');
      }
    } catch {
      errors.push('Invalid quoteOut format');
    }

    // Validate solver fee
    if (bid.solverFeeBps < 0 || bid.solverFeeBps > config.bidding.maxSolverFeeBps) {
      errors.push(`Solver fee must be between 0 and ${config.bidding.maxSolverFeeBps} bps`);
    }

    // Validate TTL
    if (bid.ttlMs < 1000 || bid.ttlMs > 300000) { // 1s to 5min
      errors.push('TTL must be between 1000ms and 300000ms');
    }

    // Validate signature
    if (!this.isValidSignature(bid.solverSig)) {
      errors.push('Invalid signature format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default CryptoUtils;