/**
 * @fileoverview Abstract base class for bid strategies
 * @description Defines the interface and common functionality for all bid strategies
 */

import type {
  Intent,
  Quote,
  BidResponse
} from '../types/index.js';

export abstract class BaseBidStrategy {
  protected config: any;

  constructor(config: any = {}) {
    this.config = config;
  }

  /**
   * Generate a bid response based on intent and available quotes
   * Must be implemented by concrete strategy classes
   */
  abstract generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null>;

  /**
   * Select the best quote from available quotes
   * Can be overridden by strategy implementations
   */
  protected selectBestQuote(quotes: Quote[]): Quote {
    if (quotes.length === 0) {
      throw new Error('No quotes available');
    }

    // Default: select quote with highest output amount
    return quotes.reduce((best, current) => {
      return current.amountOut > best.amountOut ? current : best;
    });
  }

  /**
   * Calculate solver fee based on strategy and market conditions
   * Can be overridden by strategy implementations
   */
  protected calculateSolverFee(intent: Intent, quote: Quote): number {
    // Default implementation: fixed fee
    return this.config.baseFee || 10; // 10 bps = 0.1%
  }

  /**
   * Calculate TTL for the bid
   * Can be overridden by strategy implementations
   */
  protected calculateTTL(intent: Intent, quote: Quote): number {
    // Default: 3 seconds
    return this.config.defaultTTL || 3000;
  }

  /**
   * Build calldata hint for execution
   * Can be overridden by strategy implementations
   */
  protected async buildCalldataHint(intent: Intent, quote: Quote): Promise<string> {
    // Simplified calldata hint generation
    // In production, this would build actual router calldata
    const data = {
      tokenIn: intent.tokenIn,
      tokenOut: intent.tokenOut,
      amountIn: intent.amountIn,
      route: quote.route,
      source: quote.source
    };

    // Convert to hex string (simplified)
    const jsonString = JSON.stringify(data);
    const hexString = Buffer.from(jsonString, 'utf8').toString('hex');
    return `0x${hexString}`;
  }

  /**
   * Validate if we should bid on this intent
   * Can be overridden by strategy implementations
   */
  protected shouldBid(intent: Intent, quotes: Quote[]): boolean {
    // Basic validation
    if (quotes.length === 0) {
      return false;
    }

    // Check if intent is still valid (not expired)
    const deadline = parseInt(intent.deadline);
    if (deadline * 1000 < Date.now()) {
      return false;
    }

    // Check if we have enough time to process
    const timeUntilDeadline = (deadline * 1000) - Date.now();
    if (timeUntilDeadline < 5000) { // Less than 5 seconds
      return false;
    }

    return true;
  }

  /**
   * Calculate expected profit for the trade
   */
  protected calculateExpectedProfit(intent: Intent, quote: Quote, solverFeeBps: number): bigint {
    const amountIn = BigInt(intent.amountIn);
    const amountOut = quote.amountOut;
    const solverFee = (amountOut * BigInt(solverFeeBps)) / BigInt(10000);
    
    // Simple profit calculation (solver fee minus gas costs)
    const estimatedGasCost = quote.gasEstimate * BigInt(20); // Assume 20 gwei gas price
    return solverFee - estimatedGasCost;
  }

  /**
   * Check if the trade is profitable
   */
  protected isProfitable(intent: Intent, quote: Quote, solverFeeBps: number): boolean {
    const expectedProfit = this.calculateExpectedProfit(intent, quote, solverFeeBps);
    return expectedProfit > BigInt(0);
  }

  /**
   * Apply slippage protection
   */
  protected applySlippageProtection(quote: Quote, maxSlippageBps: number): Quote {
    const slippageMultiplier = BigInt(10000 - maxSlippageBps);
    const adjustedAmountOut = (quote.amountOut * slippageMultiplier) / BigInt(10000);

    return {
      ...quote,
      amountOut: adjustedAmountOut
    };
  }

  /**
   * Get strategy name
   */
  abstract getStrategyName(): string;

  /**
   * Get strategy configuration
   */
  getConfig(): any {
    return { ...this.config };
  }

  /**
   * Update strategy configuration
   */
  updateConfig(newConfig: any): void {
    this.config = { ...this.config, ...newConfig };
  }
}