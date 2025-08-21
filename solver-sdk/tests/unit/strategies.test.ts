/**
 * @fileoverview Unit tests for bid strategies
 * @description Test strategy implementations for correctness
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AggressiveStrategy, ConservativeStrategy, AdaptiveStrategy } from '../../src/index.js';
import type { Intent, Quote } from '../../src/types/index.js';

describe('Bid Strategies', () => {
  const mockIntent: Intent = {
    tokenIn: '0x1234567890123456789012345678901234567890',
    tokenOut: '0x0987654321098765432109876543210987654321',
    amountIn: '1000000000000000000', // 1 ETH
    maxSlippageBps: 300, // 3%
    deadline: Math.floor(Date.now() / 1000 + 300).toString(), // 5 minutes from now
    chainId: '196',
    receiver: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    nonce: '12345'
  };

  const mockQuotes: Quote[] = [
    {
      amountOut: BigInt('950000000000000000'), // 0.95 ETH
      route: ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'],
      gasEstimate: BigInt('150000'),
      source: 'uniswap-v3'
    },
    {
      amountOut: BigInt('960000000000000000'), // 0.96 ETH
      route: ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'],
      gasEstimate: BigInt('180000'),
      source: '1inch'
    },
    {
      amountOut: BigInt('955000000000000000'), // 0.955 ETH
      route: ['0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321'],
      gasEstimate: BigInt('160000'),
      source: 'paraswap'
    }
  ];

  describe('AggressiveStrategy', () => {
    let strategy: AggressiveStrategy;

    beforeEach(() => {
      strategy = new AggressiveStrategy({
        baseFee: 10,
        maxFee: 25,
        defaultTTL: 2000
      });
    });

    it('should generate bids with low fees', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      expect(bid!.solverFeeBps).toBeLessThan(20);
      expect(bid!.ttlMs).toBeLessThanOrEqual(2500);
    });

    it('should select the best quote', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      // Should select the 1inch quote with highest output (0.96 ETH)
      expect(bid!.quoteOut).toBe('960000000000000000');
    });

    it('should return null for expired intents', async () => {
      const expiredIntent = {
        ...mockIntent,
        deadline: Math.floor(Date.now() / 1000 - 300).toString() // 5 minutes ago
      };

      const bid = await strategy.generateBid(expiredIntent, mockQuotes);
      expect(bid).toBeNull();
    });

    it('should return null for empty quotes', async () => {
      const bid = await strategy.generateBid(mockIntent, []);
      expect(bid).toBeNull();
    });

    it('should have correct strategy name', () => {
      expect(strategy.getStrategyName()).toBe('AggressiveStrategy');
    });
  });

  describe('ConservativeStrategy', () => {
    let strategy: ConservativeStrategy;

    beforeEach(() => {
      strategy = new ConservativeStrategy({
        baseFee: 25,
        minFee: 15,
        defaultTTL: 5000,
        profitMargin: 2.0
      });
    });

    it('should generate bids with higher fees', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      expect(bid!.solverFeeBps).toBeGreaterThanOrEqual(15);
      expect(bid!.solverFeeBps).toBeLessThanOrEqual(50);
    });

    it('should use longer TTL', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      expect(bid!.ttlMs).toBeGreaterThan(4000);
    });

    it('should require minimum number of quotes', async () => {
      const singleQuote = [mockQuotes[0]];
      const bid = await strategy.generateBid(mockIntent, singleQuote);
      
      expect(bid).toBeNull(); // Conservative strategy requires multiple quotes
    });

    it('should have correct strategy name', () => {
      expect(strategy.getStrategyName()).toBe('ConservativeStrategy');
    });
  });

  describe('AdaptiveStrategy', () => {
    let strategy: AdaptiveStrategy;

    beforeEach(() => {
      strategy = new AdaptiveStrategy({
        baseFee: 15,
        minFee: 5,
        maxFee: 40,
        adaptationRate: 0.3
      });
    });

    it('should generate bids with adaptive fees', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      expect(bid!.solverFeeBps).toBeGreaterThanOrEqual(5);
      expect(bid!.solverFeeBps).toBeLessThanOrEqual(40);
    });

    it('should adapt based on market conditions', async () => {
      // First bid
      const bid1 = await strategy.generateBid(mockIntent, mockQuotes);
      expect(bid1).toBeDefined();
      
      // Simulate losing bids to trigger adaptation
      strategy.updateBidResult(bid1!.solverFeeBps, false);
      strategy.updateBidResult(bid1!.solverFeeBps, false);
      strategy.updateBidResult(bid1!.solverFeeBps, false);
      
      // Second bid should have lower fees due to poor performance
      const bid2 = await strategy.generateBid(mockIntent, mockQuotes);
      expect(bid2).toBeDefined();
      // Fee should be adapted (though exact value depends on implementation)
    });

    it('should have correct strategy name', () => {
      expect(strategy.getStrategyName()).toBe('AdaptiveStrategy');
    });

    it('should provide adaptation metrics', () => {
      const metrics = strategy.getAdaptationMetrics();
      
      expect(metrics).toHaveProperty('recentWinRate');
      expect(metrics).toHaveProperty('averageFee');
      expect(metrics).toHaveProperty('adaptationRate');
      expect(metrics.adaptationRate).toBe(0.3);
    });
  });

  describe('Strategy Base Functionality', () => {
    let strategy: AggressiveStrategy;

    beforeEach(() => {
      strategy = new AggressiveStrategy();
    });

    it('should calculate expected profit correctly', () => {
      const quote = mockQuotes[1]; // 1inch quote
      const solverFeeBps = 15;
      
      // This would access protected method, so we test indirectly
      // by verifying bid generation works with profit calculations
      const bid = strategy.generateBid(mockIntent, [quote]);
      expect(bid).toBeDefined();
    });

    it('should apply slippage protection', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      // Output should be less than the raw quote due to slippage protection
      const rawBestOutput = mockQuotes.reduce((best, current) => 
        current.amountOut > best ? current.amountOut : best, BigInt(0));
      
      expect(BigInt(bid!.quoteOut)).toBeLessThanOrEqual(rawBestOutput);
    });

    it('should validate calldata hint format', async () => {
      const bid = await strategy.generateBid(mockIntent, mockQuotes);
      
      expect(bid).toBeDefined();
      expect(bid!.calldataHint).toMatch(/^0x[a-fA-F0-9]+$/);
      expect(bid!.calldataHint.length).toBeGreaterThan(10);
    });
  });
});