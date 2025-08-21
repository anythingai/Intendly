/**
 * @fileoverview Adaptive bidding strategy
 * @description Dynamic fee adjustment based on market conditions and competition
 */

import { BaseBidStrategy } from './BaseBidStrategy.js';
import type {
  Intent,
  Quote,
  BidResponse
} from '../types/index.js';

export interface AdaptiveStrategyConfig {
  baseFee?: number; // Base fee in basis points (default: 15)
  minFee?: number; // Minimum fee in basis points (default: 5)
  maxFee?: number; // Maximum fee in basis points (default: 50)
  defaultTTL?: number; // Default TTL in ms (default: 3500)
  adaptationRate?: number; // How quickly to adapt (0-1, default: 0.3)
  profitTargetMultiplier?: number; // Profit target multiplier (default: 1.5)
}

interface MarketConditions {
  competitionLevel: number; // 0-10 scale
  volatility: number; // 0-1 scale
  liquidity: number; // 0-1 scale
  gasPrice: number; // Current gas price level
}

export class AdaptiveStrategy extends BaseBidStrategy {
  private strategyConfig: Required<AdaptiveStrategyConfig>;
  private recentBids: Array<{ timestamp: number; won: boolean; fee: number }> = [];
  private marketHistory: Array<{ timestamp: number; conditions: MarketConditions }> = [];

  constructor(config: AdaptiveStrategyConfig = {}) {
    super(config);
    
    this.strategyConfig = {
      baseFee: config.baseFee || 15, // 0.15%
      minFee: config.minFee || 5, // 0.05%
      maxFee: config.maxFee || 50, // 0.5%
      defaultTTL: config.defaultTTL || 3500, // 3.5 seconds
      adaptationRate: config.adaptationRate || 0.3,
      profitTargetMultiplier: config.profitTargetMultiplier || 1.5
    };
  }

  /**
   * Generate adaptive bid based on current market conditions
   */
  async generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null> {
    if (!this.shouldBid(intent, quotes)) {
      return null;
    }

    try {
      // Analyze current market conditions
      const marketConditions = this.analyzeMarketConditions(intent, quotes);
      this.recordMarketConditions(marketConditions);

      // Select best quote using adaptive criteria
      const bestQuote = this.selectAdaptiveQuote(quotes, marketConditions);
      
      // Apply dynamic slippage protection
      const protectedQuote = this.applyAdaptiveSlippage(bestQuote, intent.maxSlippageBps, marketConditions);
      
      // Calculate adaptive fee based on conditions and history
      const solverFeeBps = this.calculateAdaptiveFee(intent, protectedQuote, marketConditions);
      
      // Check profitability with adaptive thresholds
      if (!this.isAdaptivelyProfitable(intent, protectedQuote, solverFeeBps, marketConditions)) {
        return null;
      }

      // Build calldata hint
      const calldataHint = await this.buildCalldataHint(intent, protectedQuote);
      
      // Calculate adaptive TTL
      const ttlMs = this.calculateAdaptiveTTL(intent, protectedQuote, marketConditions);

      // Record this bid attempt
      this.recordBidAttempt(solverFeeBps);

      return {
        quoteOut: protectedQuote.amountOut.toString(),
        solverFeeBps,
        calldataHint,
        ttlMs
      };
    } catch (error) {
      console.error('Error generating adaptive bid:', error);
      return null;
    }
  }

  /**
   * Analyze current market conditions
   */
  private analyzeMarketConditions(intent: Intent, quotes: Quote[]): MarketConditions {
    // Competition level based on quote diversity and count
    const sourceCount = new Set(quotes.map(q => q.source)).size;
    const competitionLevel = Math.min(sourceCount * 1.5, 10);

    // Volatility based on quote price spread
    const outputs = quotes.map(q => Number(q.amountOut));
    const maxOutput = Math.max(...outputs);
    const minOutput = Math.min(...outputs);
    const volatility = maxOutput > 0 ? (maxOutput - minOutput) / maxOutput : 0;

    // Liquidity estimate based on quote amounts and gas estimates
    const avgGas = quotes.reduce((sum, q) => sum + Number(q.gasEstimate), 0) / quotes.length;
    const liquidity = Math.max(0, 1 - (avgGas / 500000)); // Normalize against complex trades

    // Gas price level (simplified - in production would fetch from network)
    const gasPrice = 0.5; // Medium gas level

    return {
      competitionLevel,
      volatility,
      liquidity,
      gasPrice
    };
  }

  /**
   * Calculate adaptive fee based on market conditions and recent performance
   */
  private calculateAdaptiveFee(intent: Intent, quote: Quote, conditions: MarketConditions): number {
    let adaptiveFee = this.strategyConfig.baseFee;

    // Adjust based on recent win rate
    const recentWinRate = this.calculateRecentWinRate();
    if (recentWinRate < 0.3) {
      // Low win rate - reduce fees to be more competitive
      adaptiveFee *= (1 - this.strategyConfig.adaptationRate);
    } else if (recentWinRate > 0.7) {
      // High win rate - can increase fees for more profit
      adaptiveFee *= (1 + this.strategyConfig.adaptationRate * 0.5);
    }

    // Adjust based on competition level
    const competitionAdjustment = (conditions.competitionLevel / 10) * -5; // More competition = lower fees
    adaptiveFee += competitionAdjustment;

    // Adjust based on volatility
    if (conditions.volatility > 0.05) {
      adaptiveFee += 2; // Higher fees in volatile conditions
    }

    // Adjust based on liquidity
    if (conditions.liquidity < 0.3) {
      adaptiveFee += 3; // Higher fees for low liquidity trades
    }

    // Adjust based on trade size
    const amountIn = BigInt(intent.amountIn);
    const tradeSize = Number(amountIn) / 1e18;
    if (tradeSize > 50) {
      adaptiveFee += 2; // Higher fees for large trades
    }

    // Ensure within bounds
    return Math.max(
      this.strategyConfig.minFee,
      Math.min(adaptiveFee, this.strategyConfig.maxFee)
    );
  }

  /**
   * Select quote using adaptive criteria
   */
  private selectAdaptiveQuote(quotes: Quote[], conditions: MarketConditions): Quote {
    // In high competition, prioritize highest output
    if (conditions.competitionLevel > 7) {
      return quotes.reduce((best, current) => 
        current.amountOut > best.amountOut ? current : best
      );
    }

    // In low liquidity, prioritize lower gas usage
    if (conditions.liquidity < 0.3) {
      return quotes.reduce((best, current) => {
        const currentScore = Number(current.amountOut) / Number(current.gasEstimate);
        const bestScore = Number(best.amountOut) / Number(best.gasEstimate);
        return currentScore > bestScore ? current : best;
      });
    }

    // Balanced selection by default
    return quotes.reduce((best, current) => {
      const currentScore = Number(current.amountOut) * 0.8 + (300000 - Number(current.gasEstimate)) * 0.2;
      const bestScore = Number(best.amountOut) * 0.8 + (300000 - Number(best.gasEstimate)) * 0.2;
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Apply adaptive slippage protection
   */
  private applyAdaptiveSlippage(quote: Quote, maxSlippageBps: number, conditions: MarketConditions): Quote {
    let slippageBuffer = 0;

    // Add buffer based on volatility
    if (conditions.volatility > 0.03) {
      slippageBuffer += 25; // +0.25% in volatile conditions
    }

    // Add buffer based on liquidity
    if (conditions.liquidity < 0.5) {
      slippageBuffer += 15; // +0.15% in low liquidity
    }

    const totalSlippageBps = Math.min(maxSlippageBps + slippageBuffer, 1000);
    return this.applySlippageProtection(quote, totalSlippageBps);
  }

  /**
   * Calculate adaptive TTL
   */
  private calculateAdaptiveTTL(intent: Intent, quote: Quote, conditions: MarketConditions): number {
    let adaptiveTTL = this.strategyConfig.defaultTTL;

    // Shorter TTL in high competition
    if (conditions.competitionLevel > 7) {
      adaptiveTTL *= 0.8;
    }

    // Longer TTL in volatile conditions for safety
    if (conditions.volatility > 0.05) {
      adaptiveTTL *= 1.2;
    }

    // Adjust based on gas complexity
    const gasComplexity = Number(quote.gasEstimate);
    if (gasComplexity > 250000) {
      adaptiveTTL *= 1.1;
    }

    return Math.max(1500, Math.min(adaptiveTTL, 8000)); // 1.5s to 8s range
  }

  /**
   * Check profitability with adaptive thresholds
   */
  private isAdaptivelyProfitable(intent: Intent, quote: Quote, solverFeeBps: number, conditions: MarketConditions): boolean {
    const expectedProfit = this.calculateExpectedProfit(intent, quote, solverFeeBps);
    
    // Adaptive profit threshold based on market conditions
    const baseThreshold = BigInt(500000000000000); // 0.0005 ETH base
    let adaptiveThreshold = baseThreshold;

    // Higher threshold in risky conditions
    if (conditions.volatility > 0.05) {
      adaptiveThreshold = (adaptiveThreshold * BigInt(150)) / BigInt(100); // +50%
    }

    if (conditions.liquidity < 0.3) {
      adaptiveThreshold = (adaptiveThreshold * BigInt(120)) / BigInt(100); // +20%
    }

    return expectedProfit >= adaptiveThreshold;
  }

  /**
   * Record bid attempt for learning
   */
  private recordBidAttempt(fee: number): void {
    this.recentBids.push({
      timestamp: Date.now(),
      won: false, // Will be updated when we know the result
      fee
    });

    // Keep only last 50 bids
    if (this.recentBids.length > 50) {
      this.recentBids = this.recentBids.slice(-50);
    }
  }

  /**
   * Record market conditions for learning
   */
  private recordMarketConditions(conditions: MarketConditions): void {
    this.marketHistory.push({
      timestamp: Date.now(),
      conditions
    });

    // Keep only last 100 market snapshots
    if (this.marketHistory.length > 100) {
      this.marketHistory = this.marketHistory.slice(-100);
    }
  }

  /**
   * Calculate recent win rate for adaptation
   */
  private calculateRecentWinRate(): number {
    const recent = this.recentBids.slice(-20); // Last 20 bids
    if (recent.length === 0) return 0.5; // Default to neutral

    const wonBids = recent.filter(bid => bid.won).length;
    return wonBids / recent.length;
  }

  /**
   * Update bid result for learning (to be called externally)
   */
  updateBidResult(fee: number, won: boolean): void {
    const recentBid = this.recentBids
      .slice()
      .reverse()
      .find(bid => Math.abs(bid.fee - fee) < 0.1);
    
    if (recentBid) {
      recentBid.won = won;
    }
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 'AdaptiveStrategy';
  }

  /**
   * Get current adaptation metrics
   */
  getAdaptationMetrics(): {
    recentWinRate: number;
    averageFee: number;
    adaptationRate: number;
    marketConditions: MarketConditions | null;
  } {
    const recentConditions = this.marketHistory.length > 0 
      ? this.marketHistory[this.marketHistory.length - 1].conditions 
      : null;

    const avgFee = this.recentBids.length > 0
      ? this.recentBids.reduce((sum, bid) => sum + bid.fee, 0) / this.recentBids.length
      : this.strategyConfig.baseFee;

    return {
      recentWinRate: this.calculateRecentWinRate(),
      averageFee: avgFee,
      adaptationRate: this.strategyConfig.adaptationRate,
      marketConditions: recentConditions
    };
  }
}