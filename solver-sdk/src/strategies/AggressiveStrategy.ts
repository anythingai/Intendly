/**
 * @fileoverview Aggressive bidding strategy
 * @description Low fee, fast response strategy optimized for winning bids
 */

import { BaseBidStrategy } from './BaseBidStrategy.js';
import type {
  Intent,
  Quote,
  BidResponse
} from '../types/index.js';

export interface AggressiveStrategyConfig {
  baseFee?: number; // Base fee in basis points (default: 5)
  maxFee?: number; // Maximum fee in basis points (default: 20)
  defaultTTL?: number; // Default TTL in ms (default: 2000)
  minProfitThreshold?: bigint; // Minimum profit threshold (default: 0)
}

export class AggressiveStrategy extends BaseBidStrategy {
  private strategyConfig: Required<AggressiveStrategyConfig>;

  constructor(config: AggressiveStrategyConfig = {}) {
    super(config);
    
    this.strategyConfig = {
      baseFee: config.baseFee || 5, // 0.05%
      maxFee: config.maxFee || 20, // 0.2%
      defaultTTL: config.defaultTTL || 2000, // 2 seconds
      minProfitThreshold: config.minProfitThreshold || BigInt(0)
    };
  }

  /**
   * Generate aggressive bid - prioritizes speed and winning
   */
  async generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null> {
    if (!this.shouldBid(intent, quotes)) {
      return null;
    }

    try {
      // Select best quote quickly
      const bestQuote = this.selectBestQuote(quotes);
      
      // Apply slippage protection
      const protectedQuote = this.applySlippageProtection(bestQuote, intent.maxSlippageBps);
      
      // Calculate aggressive (low) fee to win bid
      const solverFeeBps = this.calculateAggressiveFee(intent, protectedQuote, quotes);
      
      // Check if still profitable with low fee
      if (!this.isProfitable(intent, protectedQuote, solverFeeBps)) {
        return null;
      }

      // Build calldata hint
      const calldataHint = await this.buildCalldataHint(intent, protectedQuote);
      
      // Use shorter TTL for faster execution
      const ttlMs = this.calculateAggressiveTTL(intent, protectedQuote);

      return {
        quoteOut: protectedQuote.amountOut.toString(),
        solverFeeBps,
        calldataHint,
        ttlMs
      };
    } catch (error) {
      console.error('Error generating aggressive bid:', error);
      return null;
    }
  }

  /**
   * Calculate aggressive fee - lower than base to increase chances of winning
   */
  private calculateAggressiveFee(intent: Intent, quote: Quote, allQuotes: Quote[]): number {
    const baseFee = this.strategyConfig.baseFee;
    
    // Reduce fee based on competition level
    const competitionLevel = this.estimateCompetition(allQuotes);
    const feeReduction = Math.min(competitionLevel * 1, baseFee * 0.5); // Max 50% reduction
    
    const adjustedFee = Math.max(1, baseFee - feeReduction); // Minimum 1 bps
    
    return Math.min(adjustedFee, this.strategyConfig.maxFee);
  }

  /**
   * Calculate aggressive TTL - shorter for faster execution
   */
  private calculateAggressiveTTL(intent: Intent, quote: Quote): number {
    const baseTTL = this.strategyConfig.defaultTTL;
    
    // Reduce TTL based on gas estimate (faster for simpler trades)
    const gasComplexity = Number(quote.gasEstimate);
    const ttlReduction = Math.min(gasComplexity / 100000, 500); // Max 500ms reduction
    
    return Math.max(1000, baseTTL - ttlReduction); // Minimum 1 second
  }

  /**
   * Estimate competition level based on available quotes
   */
  private estimateCompetition(quotes: Quote[]): number {
    // More quotes = more competition
    const sourceCount = new Set(quotes.map(q => q.source)).size;
    
    // Price spread indicates competition
    const outputs = quotes.map(q => q.amountOut);
    const maxOutput = outputs.reduce((max, curr) => curr > max ? curr : max);
    const minOutput = outputs.reduce((min, curr) => curr < min ? curr : min);
    const spread = Number(maxOutput - minOutput) / Number(maxOutput);
    
    // Higher source count and lower spread = more competition
    const competitionScore = sourceCount * (1 - spread) * 2;
    
    return Math.min(competitionScore, 5); // Cap at 5
  }

  /**
   * Override shouldBid for more aggressive criteria
   */
  protected shouldBid(intent: Intent, quotes: Quote[]): boolean {
    if (!super.shouldBid(intent, quotes)) {
      return false;
    }

    // More aggressive - bid even with shorter time windows
    const deadline = parseInt(intent.deadline);
    const timeUntilDeadline = (deadline * 1000) - Date.now();
    
    // Accept intents with at least 2 seconds remaining
    return timeUntilDeadline >= 2000;
  }

  /**
   * Override profit calculation for aggressive strategy
   */
  protected isProfitable(intent: Intent, quote: Quote, solverFeeBps: number): boolean {
    const expectedProfit = this.calculateExpectedProfit(intent, quote, solverFeeBps);
    return expectedProfit >= this.strategyConfig.minProfitThreshold;
  }

  /**
   * Select best quote with aggressive criteria
   */
  protected selectBestQuote(quotes: Quote[]): Quote {
    // Prefer quotes with lower gas estimates for faster execution
    return quotes.reduce((best, current) => {
      // Primarily select by output amount
      if (current.amountOut > best.amountOut) {
        return current;
      }
      
      // If output amounts are close, prefer lower gas
      const outputDiff = Number(best.amountOut - current.amountOut);
      const outputThreshold = Number(best.amountOut) * 0.001; // 0.1% threshold
      
      if (outputDiff < outputThreshold && current.gasEstimate < best.gasEstimate) {
        return current;
      }
      
      return best;
    });
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 'AggressiveStrategy';
  }

  /**
   * Get strategy-specific metrics
   */
  getStrategyMetrics(): {
    averageFee: number;
    averageTTL: number;
    competitionAwareness: boolean;
  } {
    return {
      averageFee: this.strategyConfig.baseFee,
      averageTTL: this.strategyConfig.defaultTTL,
      competitionAwareness: true
    };
  }
}