/**
 * @fileoverview Conservative bidding strategy
 * @description Higher fee, reliable execution strategy focused on profitability
 */

import { BaseBidStrategy } from './BaseBidStrategy.js';
import type {
  Intent,
  Quote,
  BidResponse
} from '../types/index.js';

export interface ConservativeStrategyConfig {
  baseFee?: number; // Base fee in basis points (default: 25)
  minFee?: number; // Minimum fee in basis points (default: 15)
  defaultTTL?: number; // Default TTL in ms (default: 5000)
  minProfitThreshold?: bigint; // Minimum profit threshold
  profitMargin?: number; // Required profit margin multiplier (default: 2.0)
}

export class ConservativeStrategy extends BaseBidStrategy {
  private strategyConfig: Required<ConservativeStrategyConfig>;

  constructor(config: ConservativeStrategyConfig = {}) {
    super(config);
    
    this.strategyConfig = {
      baseFee: config.baseFee || 25, // 0.25%
      minFee: config.minFee || 15, // 0.15%
      defaultTTL: config.defaultTTL || 5000, // 5 seconds
      minProfitThreshold: config.minProfitThreshold || BigInt(1000000000000000), // 0.001 ETH
      profitMargin: config.profitMargin || 2.0
    };
  }

  /**
   * Generate conservative bid - prioritizes profitability and reliability
   */
  async generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null> {
    if (!this.shouldBid(intent, quotes)) {
      return null;
    }

    try {
      // Select most reliable quote (not necessarily best price)
      const reliableQuote = this.selectReliableQuote(quotes);
      
      // Apply conservative slippage protection
      const protectedQuote = this.applyConservativeSlippage(reliableQuote, intent.maxSlippageBps);
      
      // Calculate conservative fee for higher profit margin
      const solverFeeBps = this.calculateConservativeFee(intent, protectedQuote);
      
      // Strict profitability check
      if (!this.isHighlyProfitable(intent, protectedQuote, solverFeeBps)) {
        return null;
      }

      // Build calldata hint
      const calldataHint = await this.buildCalldataHint(intent, protectedQuote);
      
      // Use longer TTL for reliability
      const ttlMs = this.calculateConservativeTTL(intent, protectedQuote);

      return {
        quoteOut: protectedQuote.amountOut.toString(),
        solverFeeBps,
        calldataHint,
        ttlMs
      };
    } catch (error) {
      console.error('Error generating conservative bid:', error);
      return null;
    }
  }

  /**
   * Select reliable quote based on source reputation and gas efficiency
   */
  private selectReliableQuote(quotes: Quote[]): Quote {
    // Prefer well-known, reliable sources
    const sourceReliability: Record<string, number> = {
      'uniswap-v3': 10,
      'uniswap-v2': 8,
      'sushiswap': 7,
      'curve': 9,
      '1inch': 8,
      'paraswap': 7
    };

    return quotes.reduce((best, current) => {
      const currentReliability = sourceReliability[current.source.toLowerCase()] || 5;
      const bestReliability = sourceReliability[best.source.toLowerCase()] || 5;
      
      // Weight by reliability and output amount
      const currentScore = Number(current.amountOut) * currentReliability;
      const bestScore = Number(best.amountOut) * bestReliability;
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Apply conservative slippage protection (additional buffer)
   */
  private applyConservativeSlippage(quote: Quote, maxSlippageBps: number): Quote {
    // Add extra slippage buffer for safety
    const extraSlippageBps = 50; // Additional 0.5% slippage buffer
    const totalSlippageBps = Math.min(maxSlippageBps + extraSlippageBps, 1000); // Cap at 10%
    
    return this.applySlippageProtection(quote, totalSlippageBps);
  }

  /**
   * Calculate conservative fee with higher profit margins
   */
  private calculateConservativeFee(intent: Intent, quote: Quote): number {
    let baseFee = this.strategyConfig.baseFee;
    
    // Increase fee based on trade size (larger trades = higher fees)
    const amountIn = BigInt(intent.amountIn);
    const tradeSize = Number(amountIn) / 1e18; // Convert to ETH equivalent
    
    if (tradeSize > 10) {
      baseFee += 5; // +0.05% for large trades
    }
    if (tradeSize > 100) {
      baseFee += 10; // +0.1% for very large trades
    }

    // Increase fee based on gas complexity
    const gasComplexity = Number(quote.gasEstimate);
    if (gasComplexity > 200000) {
      baseFee += 3; // +0.03% for complex trades
    }

    return Math.max(baseFee, this.strategyConfig.minFee);
  }

  /**
   * Calculate conservative TTL with longer execution time
   */
  private calculateConservativeTTL(intent: Intent, quote: Quote): number {
    const baseTTL = this.strategyConfig.defaultTTL;
    
    // Increase TTL for complex trades
    const gasComplexity = Number(quote.gasEstimate);
    const ttlIncrease = Math.min(gasComplexity / 50000, 2000); // Max 2s increase
    
    return baseTTL + ttlIncrease;
  }

  /**
   * Strict profitability check with higher profit margin requirements
   */
  private isHighlyProfitable(intent: Intent, quote: Quote, solverFeeBps: number): boolean {
    const expectedProfit = this.calculateExpectedProfit(intent, quote, solverFeeBps);
    
    // Must exceed minimum threshold
    if (expectedProfit < this.strategyConfig.minProfitThreshold) {
      return false;
    }

    // Must have required profit margin over gas costs
    const gasEstimate = quote.gasEstimate;
    const estimatedGasCost = gasEstimate * BigInt(30); // Assume 30 gwei gas price
    const requiredProfit = estimatedGasCost * BigInt(Math.floor(this.strategyConfig.profitMargin * 100)) / BigInt(100);
    
    return expectedProfit >= requiredProfit;
  }

  /**
   * Override shouldBid with stricter criteria
   */
  protected shouldBid(intent: Intent, quotes: Quote[]): boolean {
    if (!super.shouldBid(intent, quotes)) {
      return false;
    }

    // More conservative - require longer time windows
    const deadline = parseInt(intent.deadline);
    const timeUntilDeadline = (deadline * 1000) - Date.now();
    
    // Require at least 10 seconds remaining
    if (timeUntilDeadline < 10000) {
      return false;
    }

    // Require multiple quotes for comparison
    if (quotes.length < 2) {
      return false;
    }

    // Check minimum trade size
    const amountIn = BigInt(intent.amountIn);
    const minTradeSize = BigInt(1000000000000000); // 0.001 ETH minimum
    if (amountIn < minTradeSize) {
      return false;
    }

    return true;
  }

  /**
   * Risk assessment for the trade
   */
  private assessTradeRisk(intent: Intent, quote: Quote): 'low' | 'medium' | 'high' {
    let riskScore = 0;

    // Large trades are riskier
    const amountIn = BigInt(intent.amountIn);
    const tradeSize = Number(amountIn) / 1e18;
    if (tradeSize > 100) riskScore += 2;
    else if (tradeSize > 10) riskScore += 1;

    // High gas trades are riskier
    const gasComplexity = Number(quote.gasEstimate);
    if (gasComplexity > 300000) riskScore += 2;
    else if (gasComplexity > 150000) riskScore += 1;

    // Unknown sources are riskier
    const knownSources = ['uniswap-v3', 'uniswap-v2', 'sushiswap', 'curve'];
    if (!knownSources.includes(quote.source.toLowerCase())) {
      riskScore += 1;
    }

    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  /**
   * Get strategy name
   */
  getStrategyName(): string {
    return 'ConservativeStrategy';
  }

  /**
   * Get strategy-specific metrics
   */
  getStrategyMetrics(): {
    averageFee: number;
    averageTTL: number;
    profitMargin: number;
    riskTolerance: string;
  } {
    return {
      averageFee: this.strategyConfig.baseFee,
      averageTTL: this.strategyConfig.defaultTTL,
      profitMargin: this.strategyConfig.profitMargin,
      riskTolerance: 'low'
    };
  }
}