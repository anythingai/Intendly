# Solver SDK Documentation

Complete TypeScript SDK for building competitive solvers for the Intent-Based Trading Aggregator.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Configuration](#configuration)
- [Strategies](#strategies)
- [Quote Sources](#quote-sources)
- [Performance Monitoring](#performance-monitoring)
- [Troubleshooting](#troubleshooting)

## Installation

```bash
npm install @intendly/solver-sdk
```

## Quick Start

### Basic Solver

```typescript
import { SolverClient, AggressiveStrategy } from '@intendly/solver-sdk';

const solver = new SolverClient({
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY,
  coordinatorUrl: 'https://api.intendly.xyz',
  wsUrl: 'wss://ws.intendly.xyz',
  chainId: 196, // X Layer
  bidStrategy: new AggressiveStrategy()
});

await solver.start();
console.log('🤖 Solver is running!');
```

### Custom Intent Handler

```typescript
solver.onIntent(async (intent) => {
  // Get quotes from multiple sources
  const quotes = await solver.getQuoteAggregator().getQuotes(
    intent.tokenIn,
    intent.tokenOut,
    BigInt(intent.amountIn)
  );

  if (quotes.length === 0) return null;

  // Select best quote
  const bestQuote = quotes.reduce((best, current) => 
    current.amountOut > best.amountOut ? current : best
  );

  // Return competitive bid
  return {
    quoteOut: bestQuote.amountOut.toString(),
    solverFeeBps: 15, // 0.15%
    calldataHint: '0x...',
    ttlMs: 3000
  };
});
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SolverClient  │    │ Quote Sources   │    │  Coordinator    │
│                 │    │                 │    │                 │
│ • WebSocket     │◄──►│ • 1inch API     │    │ • Intent Stream │
│ • Bid Logic     │    │ • ParaSwap API  │◄──►│ • Bid Collection│
│ • Strategies    │    │ • Uniswap V3    │    │ • Winner Select │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ Smart Contracts │
                    │                 │
                    │ • Settlement    │
                    │ • Router        │
                    │ • Permit2       │
                    └─────────────────┘
```

## Core Components

### SolverClient

The main SDK class that orchestrates all solver operations:

```typescript
interface SolverConfig {
  solverPrivateKey: string;
  coordinatorUrl: string;
  wsUrl: string;
  chainId: number;
  rpcUrl?: string;
  settlementContract?: string;
  bidStrategy?: BaseBidStrategy;
  maxResponseTimeMs?: number;
  maxConcurrentBids?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  enablePerformanceMonitoring?: boolean;
  enableAutoReconnect?: boolean;
  heartbeatIntervalMs?: number;
}

class SolverClient {
  constructor(config: SolverConfig);
  
  // Core methods
  async start(): Promise<void>;
  async stop(): Promise<void>;
  onIntent(handler: IntentHandler): void;
  
  // Quote management
  addQuoteSource(source: QuoteSource): void;
  removeQuoteSource(sourceName: string): void;
  getQuoteAggregator(): QuoteAggregator;
  
  // Strategy management
  setBidStrategy(strategy: BaseBidStrategy): void;
  
  // Monitoring
  getMetrics(): SolverMetrics;
  isActive(): boolean;
}
```

### Quote Sources

Built-in support for popular DEX aggregators:

#### 1inch API Integration

```typescript
import { OneInchSource } from '@intendly/solver-sdk';

const oneInchSource = new OneInchSource({
  apiKey: 'your-api-key',
  chainId: 196,
  rateLimit: { requestsPerSecond: 10, burstSize: 20 }
});

solver.addQuoteSource(oneInchSource);
```

#### ParaSwap Integration

```typescript
import { ParaSwapSource } from '@intendly/solver-sdk';

const paraSwapSource = new ParaSwapSource({
  apiKey: 'your-api-key',
  chainId: 196,
  partner: 'your-partner-id',
  rateLimit: { requestsPerSecond: 5, burstSize: 10 }
});

solver.addQuoteSource(paraSwapSource);
```

#### Uniswap V3 Direct Integration

```typescript
import { UniswapV3Source } from '@intendly/solver-sdk';

const uniswapSource = new UniswapV3Source({
  rpcUrl: 'https://rpc.xlayer.tech',
  chainId: 196,
  maxHops: 2
});

solver.addQuoteSource(uniswapSource);
```

## Bid Strategies

### Aggressive Strategy

Low fees, fast response times - optimized for winning bids:

```typescript
import { AggressiveStrategy } from '@intendly/solver-sdk';

const strategy = new AggressiveStrategy({
  baseFee: 5,        // 0.05%
  maxFee: 20,        // 0.2%
  defaultTTL: 2000,  // 2 seconds
  minProfitThreshold: BigInt(0)
});

solver.setBidStrategy(strategy);
```

### Conservative Strategy

Higher fees, reliable execution - focused on profitability:

```typescript
import { ConservativeStrategy } from '@intendly/solver-sdk';

const strategy = new ConservativeStrategy({
  baseFee: 25,       // 0.25%
  minFee: 15,        // 0.15%
  defaultTTL: 5000,  // 5 seconds
  minProfitThreshold: BigInt('1000000000000000'), // 0.001 ETH
  profitMargin: 2.0  // 2x profit over gas costs
});

solver.setBidStrategy(strategy);
```

### Adaptive Strategy

Dynamic fee adjustment based on market conditions:

```typescript
import { AdaptiveStrategy } from '@intendly/solver-sdk';

const strategy = new AdaptiveStrategy({
  baseFee: 15,           // 0.15%
  minFee: 5,             // 0.05%
  maxFee: 50,            // 0.5%
  adaptationRate: 0.3,   // 30% adaptation rate
  profitTargetMultiplier: 1.5
});

solver.setBidStrategy(strategy);
```

## Custom Strategy Development

Create your own bidding strategy:

```typescript
import { BaseBidStrategy } from '@intendly/solver-sdk';

class CustomStrategy extends BaseBidStrategy {
  async generateBid(intent: Intent, quotes: Quote[]): Promise<BidResponse | null> {
    if (!this.shouldBid(intent, quotes)) {
      return null;
    }

    const bestQuote = this.selectBestQuote(quotes);
    const solverFeeBps = this.calculateCustomFee(intent, bestQuote);
    
    return {
      quoteOut: bestQuote.amountOut.toString(),
      solverFeeBps,
      calldataHint: await this.buildCalldataHint(intent, bestQuote),
      ttlMs: this.calculateTTL(intent, bestQuote)
    };
  }

  private calculateCustomFee(intent: Intent, quote: Quote): number {
    // Your custom fee calculation logic
    return 10; // 0.1%
  }

  getStrategyName(): string {
    return 'CustomStrategy';
  }
}
```

## Performance Monitoring

Built-in performance tracking and metrics:

```typescript
// Get current metrics
const metrics = solver.getMetrics();
console.log(`Win Rate: ${metrics.winRate}%`);
console.log(`Avg Response: ${metrics.averageResponseTime}ms`);
console.log(`Total Volume: ${metrics.totalVolume}`);

// Performance monitor methods
const monitor = solver.getPerformanceMonitor();
const responseStats = monitor.getResponseTimeStats();
console.log(`P95 Response Time: ${responseStats.p95}ms`);

const recentPerf = monitor.getRecentPerformance(50); // Last 50 bids
console.log(`Recent Win Rate: ${recentPerf.winRate}%`);
```

## Event Handling

Listen to solver events for monitoring and debugging:

```typescript
solver.on('started', () => {
  console.log('🚀 Solver started');
});

solver.on('intentReceived', (intent) => {
  console.log(`📥 Intent: ${intent.tokenIn} -> ${intent.tokenOut}`);
});

solver.on('bidSubmitted', ({ intent, bid, result }) => {
  console.log(`✅ Bid submitted: ${bid.quoteOut}`);
});

solver.on('bidFailed', ({ intent, bid, error }) => {
  console.error(`❌ Bid failed: ${error}`);
});

solver.on('quoteFetched', ({ source, quote }) => {
  console.log(`📊 Quote from ${source}: ${quote.amountOut}`);
});

solver.on('error', (error) => {
  console.error(`🚨 Error: ${error.message}`);
});
```

## Configuration

### Environment Variables

```bash
# Core Configuration
SOLVER_PRIVATE_KEY=your-private-key
COORDINATOR_URL=https://api.intendly.xyz
WS_URL=wss://ws.intendly.xyz
CHAIN_ID=196
RPC_URL=https://rpc.xlayer.tech
SETTLEMENT_CONTRACT=0x...

# Performance Settings
MAX_RESPONSE_TIME_MS=2000
MAX_CONCURRENT_BIDS=10
RETRY_ATTEMPTS=3
ENABLE_PERFORMANCE_MONITORING=true

# Quote Sources
ONEINCH_ENABLED=true
ONEINCH_API_KEY=your-api-key
PARASWAP_ENABLED=true
PARASWAP_API_KEY=your-api-key
UNISWAP_V3_ENABLED=true
```

### Advanced Configuration

```typescript
const config: SolverConfig = {
  // Core settings
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY!,
  coordinatorUrl: process.env.COORDINATOR_URL!,
  wsUrl: process.env.WS_URL!,
  chainId: parseInt(process.env.CHAIN_ID!),
  
  // Performance tuning
  maxResponseTimeMs: 1500,
  maxConcurrentBids: 15,
  retryAttempts: 5,
  retryDelayMs: 200,
  
  // WebSocket settings
  enableAutoReconnect: true,
  heartbeatIntervalMs: 30000,
  
  // Monitoring
  enablePerformanceMonitoring: true,
  
  // Strategy
  bidStrategy: new AdaptiveStrategy({
    baseFee: 12,
    adaptationRate: 0.4
  })
};
```

## Error Handling

Robust error handling and recovery:

```typescript
solver.on('error', (error) => {
  if (error.message.includes('Rate limit')) {
    console.log('Rate limited, backing off...');
    // Implement backoff strategy
  } else if (error.message.includes('WebSocket')) {
    console.log('WebSocket error, will auto-reconnect...');
    // SDK handles reconnection automatically
  } else {
    console.error('Unexpected error:', error);
    // Log to monitoring service
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down solver...');
  await solver.stop();
  process.exit(0);
});
```

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { AggressiveStrategy } from '@intendly/solver-sdk';

describe('AggressiveStrategy', () => {
  it('should generate competitive bids', async () => {
    const strategy = new AggressiveStrategy();
    const mockIntent = { /* ... */ };
    const mockQuotes = [{ /* ... */ }];
    
    const bid = await strategy.generateBid(mockIntent, mockQuotes);
    
    expect(bid).toBeDefined();
    expect(bid.solverFeeBps).toBeLessThan(20);
  });
});
```

### Integration Tests

```typescript
import { SolverClient } from '@intendly/solver-sdk';

describe('Solver Integration', () => {
  it('should connect and process intents', async () => {
    const solver = new SolverClient(testConfig);
    
    let intentReceived = false;
    solver.on('intentReceived', () => {
      intentReceived = true;
    });
    
    await solver.start();
    
    // Simulate intent
    await simulateIntent();
    
    expect(intentReceived).toBe(true);
    await solver.stop();
  });
});
```

## Troubleshooting

### Common Issues

**Authentication Failed**
```
Error: Authentication failed: Invalid solver private key
```
- Verify your `SOLVER_PRIVATE_KEY` is correctly set
- Ensure the private key has sufficient permissions

**WebSocket Connection Issues**
```
Error: WebSocket connection timeout
```
- Check the `WS_URL` configuration
- Verify network connectivity
- Check if the coordinator service is running

**No Quotes Available**
```
Warning: No quotes available for pair
```
- Verify quote source configurations
- Check API keys for 1inch/ParaSwap
- Ensure RPC URL is working for Uniswap V3

**Rate Limiting**
```
Error: Rate limit exceeded
```
- Reduce request frequency in quote source configurations
- Implement exponential backoff
- Consider upgrading API plans

### Debug Mode

Enable detailed logging:

```typescript
const solver = new SolverClient({
  ...config,
  debugMode: true // Enable debug logging
});
```

### Performance Issues

**High Response Times**
- Reduce `maxResponseTimeMs`
- Optimize quote source configurations
- Use fewer quote sources for faster responses

**Low Win Rate**
- Switch to more aggressive strategy
- Reduce fees
- Improve quote source coverage

## Support

- **Documentation**: https://docs.intendly.xyz/solver-sdk
- **GitHub**: https://github.com/intendly/intent-trading-aggregator
- **Discord**: https://discord.gg/intendly
- **Email**: support@intendly.xyz

## License

MIT License - see LICENSE file for details.