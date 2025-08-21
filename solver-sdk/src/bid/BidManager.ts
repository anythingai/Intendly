/**
 * @fileoverview Bid creation, validation, and submission
 * @description Manages bid lifecycle from creation to submission
 */

import { EventEmitter } from 'eventemitter3';
import type {
  Intent,
  BidResponse,
  BidSubmissionResult,
  SolverConfig
} from '../types/index.js';
import { AuthManager } from '../auth/AuthManager.js';

export interface BidManagerEvents {
  bidSubmitted: [{ intent: Intent; bid: BidResponse; result: BidSubmissionResult }];
  bidFailed: [{ intent: Intent; bid: BidResponse; error?: string }];
  error: [Error];
}

export class BidManager extends EventEmitter<BidManagerEvents> {
  private config: SolverConfig;
  private authManager: AuthManager;
  private activeBids = new Map<string, { intent: Intent; bid: BidResponse; timestamp: number }>();

  constructor(config: SolverConfig, authManager: AuthManager) {
    super();
    this.config = config;
    this.authManager = authManager;
  }

  /**
   * Submit a bid for an intent
   */
  async submitBid(intent: Intent, bid: BidResponse): Promise<BidSubmissionResult> {
    try {
      // Validate bid
      const validationError = this.validateBid(intent, bid);
      if (validationError) {
        const result: BidSubmissionResult = {
          success: false,
          error: validationError
        };
        this.emit('bidFailed', { intent, bid, error: validationError });
        return result;
      }

      // Check if we're already bidding on this intent
      const intentKey = this.getIntentKey(intent);
      if (this.activeBids.has(intentKey)) {
        const result: BidSubmissionResult = {
          success: false,
          error: 'Already submitted bid for this intent'
        };
        this.emit('bidFailed', { intent, bid, error: result.error });
        return result;
      }

      // Track active bid
      this.activeBids.set(intentKey, {
        intent,
        bid,
        timestamp: Date.now()
      });

      // Submit bid to coordinator
      const client = await this.authManager.getAuthenticatedClient();
      const response = await client.post('/bids', {
        intentHash: this.hashIntent(intent),
        quoteOut: bid.quoteOut,
        solverFeeBps: bid.solverFeeBps,
        calldataHint: bid.calldataHint,
        ttlMs: bid.ttlMs
      });

      const result: BidSubmissionResult = {
        success: true,
        bidId: response.data.bidId
      };

      this.emit('bidSubmitted', { intent, bid, result });
      return result;

    } catch (error) {
      const result: BidSubmissionResult = {
        success: false,
        error: (error as Error).message
      };

      // Remove from active bids on failure
      const intentKey = this.getIntentKey(intent);
      this.activeBids.delete(intentKey);

      this.emit('bidFailed', { intent, bid, error: result.error });
      return result;
    }
  }

  /**
   * Validate bid parameters
   */
  private validateBid(intent: Intent, bid: BidResponse): string | null {
    // Check quote out is positive
    const quoteOut = BigInt(bid.quoteOut);
    if (quoteOut <= 0n) {
      return 'Quote out must be positive';
    }

    // Check solver fee is reasonable (0-1000 bps = 0-10%)
    if (bid.solverFeeBps < 0 || bid.solverFeeBps > 1000) {
      return 'Solver fee must be between 0 and 1000 basis points';
    }

    // Check TTL is reasonable
    if (bid.ttlMs < 1000 || bid.ttlMs > 30000) {
      return 'TTL must be between 1 and 30 seconds';
    }

    // Check calldata hint is provided
    if (!bid.calldataHint || bid.calldataHint.length < 10) {
      return 'Calldata hint must be provided';
    }

    // Check intent deadline hasn't passed
    const deadline = parseInt(intent.deadline);
    if (deadline * 1000 < Date.now()) {
      return 'Intent has already expired';
    }

    return null;
  }

  /**
   * Generate intent key for tracking
   */
  private getIntentKey(intent: Intent): string {
    return `${intent.tokenIn}-${intent.tokenOut}-${intent.amountIn}-${intent.nonce}`;
  }

  /**
   * Hash intent for submission (simplified version)
   */
  private hashIntent(intent: Intent): string {
    // In a real implementation, this would use proper EIP-712 hashing
    // For now, return a deterministic hash based on intent data
    const data = JSON.stringify({
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      maxSlippageBps: intent.maxSlippageBps,
      deadline: intent.deadline,
      chainId: intent.chainId,
      receiver: intent.receiver,
      nonce: intent.nonce
    });

    // Simple hash function (replace with proper keccak256 in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }

  /**
   * Clean up expired active bids
   */
  private cleanupExpiredBids(): void {
    const now = Date.now();
    const expiredThreshold = 60000; // 1 minute

    for (const [key, bidInfo] of this.activeBids.entries()) {
      if (now - bidInfo.timestamp > expiredThreshold) {
        this.activeBids.delete(key);
      }
    }
  }

  /**
   * Get current active bid count
   */
  getActiveBidCount(): number {
    this.cleanupExpiredBids();
    return this.activeBids.size;
  }

  /**
   * Check if we have an active bid for an intent
   */
  hasActiveBid(intent: Intent): boolean {
    const key = this.getIntentKey(intent);
    return this.activeBids.has(key);
  }

  /**
   * Clear all active bids
   */
  clearActiveBids(): void {
    this.activeBids.clear();
  }
}