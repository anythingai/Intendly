# Solver SDK

TypeScript SDK for building competitive solvers for the Intent-Based Trading Aggregator.

## Overview

The Solver SDK provides everything needed to build high-performance solvers that compete for intent execution:

- **Intent Subscription**: Real-time intent notifications via WebSocket
- **Quote Aggregation**: Built-in support for multiple DEX quote sources
- **Bid Submission**: Automated bid submission with signature validation
- **Route Optimization**: Tools for finding optimal execution paths
- **Performance Monitoring**: Built-in metrics and logging

## Quick Start

### Installation

```bash
npm install @intendly/solver-sdk
```

### Basic Usage

```typescript
import { SolverSDK } from '@intendly/solver-sdk';

const sdk = new SolverSDK({
  solverPrivateKey: process.env.SOLVER_PRIVATE_KEY,
  coordinatorUrl: 'https://api.intendly.xyz',
  wsUrl: 'wss://ws.intendly.xyz',
  chainId: 196,
});

// Subscribe to intents and respond with bids
sdk.subscribeToIntents(async (intent) => {
  // Get quotes from multiple sources
  const quotes = await Promise.all([
    uniswapSource.getQuote(intent),
    sushiSource.getQuote(intent),
    curveSource.getQuote(intent),
  ]);

  // Select best quote
  const bestQuote = quotes.reduce((best, current) => 
    current.amountOut > best.amountOut ? current : best
  );

  // Calculate competitive fee
  const solverFeeBps = calculateOptimalFee(intent, bestQuote);

  // Build router calldata
  const calldataHint = await buildRouterCalldata(intent, bestQuote);

  return {
    quoteOut: bestQuote.amountOut.toString(),
    solverFeeBps,
    calldataHint,
    ttlMs: 3000,
  };
});

console.log('🤖 Solver started and listening for intents...');
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SolverSDK     │    │ Quote Sources   │    │  Coordinator    │
│                 │    │                 │    │                 │
│ • WS Client     │◄──►│ • Uniswap V3    │    │ • Intent Stream │
│ • Bid Logic     │    │ • SushiSwap     │◄──►│ • Bid Collection│
│ • Route Builder │    │ • Curve         │    │ • Winner Select │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Smart Contracts│
                    │                 │
                    │ • Settlement    │
                    │ • Router        │
                    │ • Permit2       │
                    └─────────────────┘
```

## Core Components

### SolverSDK Class

The main SDK class that orchestrates solver operations:

```typescript
interface SolverConfig {
  solverPrivateKey: string;
  coordinatorUrl: string;
  wsUrl: string;
  chainId: number;
  rpcUrl?: string;
  settlementContract?: string;
}

class SolverSDK {
  constructor(config: SolverConfig);
  
  // Core methods
  subscribeToIntents(handler: IntentHandler): void;
  submitBid(bid: Bid): Promise<BidSubmissionResult>;
  disconnect(): void;
  
  // Utility methods
  getQuoteFromAggregator(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote>;
  buildRouterCalldata(intent: Intent, quote: Quote): Promise<string>;
  validateBid(bid: Bid): boolean;
}
```

### Quote Sources

Built-in support for popular DEX aggregators:

```typescript
// Uniswap V3 Source
const uniswapSource = new UniswapV3Source({
  routerAddress: '0x...',
  factoryAddress: '0x...',
  rpcUrl: process.env.RPC_URL,
});

// SushiSwap Source
const sushiSource = new SushiSwapSource({
  routerAddress: '0x...',
  rpcUrl: process.env.RPC_URL,
});

// Custom source implementation
class CustomSource implements QuoteSource {
  async getQuote(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<Quote> {
    // Your custom quote logic
    return {
      amountOut: calculatedAmount,
      route: ['0x...', '0x...'],
      gasEstimate: 200000n,
      source: 'custom',
    };
  }
}
```

## Advanced Usage

### Multi-Strategy Solver

```typescript
class AdvancedSolver {
  private sdk: SolverSDK;
  private quoteSources: QuoteSource[];
  private strategies: Strategy[];

  constructor(config: SolverConfig) {
    this.sdk = new SolverSDK(config);
    this.quoteSources = [
      new UniswapV3Source(config),
      new SushiSwapSource(config),
      new CurveSource(config),
    ];
    this.strategies = [
      new SpeedStrategy(),
      new ProfitStrategy(),
      new BalancedStrategy(),
    ];
  }

  async start() {
    this.sdk.subscribeToIntents(async (intent) => {
      // Parallel quote fetching
      const quotes = await Promise.allSettled(
        this.quoteSources.map(source => 
          source.getQuote(intent.tokenIn, intent.tokenOut, BigInt(intent.amountIn))
        )
      );

      const validQuotes = quotes
        .filter((result): result is PromiseFulfilledResult<Quote> => 
          result.status === 'fulfilled')
        .map(result => result.value);

      if (validQuotes.length === 0) return null;

      // Strategy selection based on market conditions
      const strategy = this.selectStrategy(intent, validQuotes);
      return strategy.generateBid(intent, validQuotes);
    });
  }

  private selectStrategy(intent: Intent, quotes: Quote[]): Strategy {
    const marketVolatility = this.calculateVolatility(quotes);
    const competitionLevel = this.estimateCompetition(intent);

    if (marketVolatility > 0.05) return this.strategies[0]; // Speed
    if (competitionLevel > 5) return this.strategies[1]; // Profit
    return this.strategies[2]; // Balanced
  }
}
```

### Risk Management

```typescript
class RiskManager {
  private maxPositionSize: bigint;
  private dailyVolumeLimit: bigint;
  private currentDailyVolume: bigint = 0n;

  constructor(config: { maxPositionSize: bigint; dailyVolumeLimit: bigint }) {
    this.maxPositionSize = config.maxPositionSize;
    this.dailyVolumeLimit = config.dailyVolumeLimit;
  }

  canSubmitBid(intent: Intent): boolean {
    const intentVolume = BigInt(intent.amountIn);
    
    // Check position size limit
    if (intentVolume > this.maxPositionSize) {
      console.log(`Intent amount ${intentVolume} exceeds max position size`);
      return false;
    }

    // Check daily volume limit
    if (this.currentDailyVolume + intentVolume > this.dailyVolumeLimit) {
      console.log('Daily volume limit reached');
      return false;
    }

    return true;
  }

  recordTrade(amount: bigint) {
    this.currentDailyVolume += amount;
  }
}
```

### Performance Monitoring

```typescript
class SolverMetrics {
  private metrics: {
    totalBids: number;
    wonBids: number;
    totalVolume: bigint;
    averageResponseTime: number;
    errors: number;
  } = {
    totalBids: 0,
    wonBids: 0,
    totalVolume: 0n,
    averageResponseTime: 0,
    errors: 0,
  };

  recordBid(responseTime: number) {
    this.metrics.totalBids++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalBids - 1) + responseTime) / 
      this.metrics.totalBids;
  }

  recordWin(volume: bigint) {
    this.metrics.wonBids++;
    this.metrics.totalVolume += volume;
  }

  recordError() {
    this.metrics.errors++;
  }

  getMetrics() {
    return {
      ...this.metrics,
      winRate: this.metrics.totalBids > 0 ? this.metrics.wonBids / this.metrics.totalBids : 0,
      errorRate: this.metrics.totalBids > 0 ? this.metrics.errors / this.metrics.totalBids : 0,
    };
  }
}
```

## Configuration

### Environment Variables

```bash
# Solver Identity
SOLVER_PRIVATE_KEY=0x...
SOLVER_NAME=My Solver
SOLVER_DESCRIPTION=High-performance DEX aggregator

# Network
CHAIN_ID=196
RPC_URL=https://xlayerrpc.okx.com

# Coordinator
COORDINATOR_URL=https://api.intendly.xyz
WS_URL=wss://ws.intendly.xyz

# Strategy
SOLVER_STRATEGY=balanced
MIN_PROFIT_BPS=5
MAX_FEE_BPS=25

# Risk Management
MAX_POSITION_SIZE=1000000000000000000000
MAX_DAILY_VOLUME=10000000000000000000000

# Performance
MAX_RESPONSE_TIME_MS=2000
QUOTE_TIMEOUT_MS=1500
```

### Configuration File

```typescript
// solver.config.ts
export default {
  solver: {
    privateKey: process.env.SOLVER_PRIVATE_KEY!,
    name: process.env.SOLVER_NAME || 'Default Solver',
    strategy: process.env.SOLVER_STRATEGY || 'balanced',
  },
  
  network: {
    chainId: parseInt(process.env.CHAIN_ID || '196'),
    rpcUrl: process.env.RPC_URL!,
  },
  
  coordinator: {
    apiUrl: process.env.COORDINATOR_URL!,
    wsUrl: process.env.WS_URL!,
  },
  
  trading: {
    minProfitBps: parseInt(process.env.MIN_PROFIT_BPS || '5'),
    maxFeeBps: parseInt(process.env.MAX_FEE_BPS || '25'),
    maxResponseTimeMs: parseInt(process.env.MAX_RESPONSE_TIME_MS || '2000'),
  },
  
  risk: {
    maxPositionSize: BigInt(process.env.MAX_POSITION_SIZE || '1000000000000000000000'),
    maxDailyVolume: BigInt(process.env.MAX_DAILY_VOLUME || '10000000000000000000000'),
  },
};
```

## Examples

### Reference Solver

See [`examples/reference-solver/`](./examples/reference-solver/) for a complete implementation:

```typescript
import { SolverSDK, UniswapV3Source, SushiSwapSource } from '@intendly/solver-sdk';
import config from './config';

class ReferenceSolver {
  private sdk: SolverSDK;
  private quoteSources: QuoteSource[];

  constructor() {
    this.sdk = new SolverSDK(config);
    this.quoteSources = [
      new UniswapV3Source(config),
      new SushiSwapSource(config),
    ];
  }

  async start() {
    console.log('🚀 Starting Reference Solver...');
    
    this.sdk.subscribeToIntents(async (intent) => {
      const startTime = Date.now();
      
      try {
        // Get quotes from all sources
        const quotes = await this.getQuotes(intent);
        if (quotes.length === 0) return null;

        // Select best quote
        const bestQuote = this.selectBestQuote(quotes);
        
        // Calculate competitive fee
        const solverFeeBps = this.calculateFee(intent, bestQuote);
        
        // Build execution calldata
        const calldataHint = await this.buildCalldata(intent, bestQuote);
        
        const responseTime = Date.now() - startTime;
        console.log(`📊 Generated bid in ${responseTime}ms`);
        
        return {
          quoteOut: bestQuote.amountOut.toString(),
          solverFeeBps,
          calldataHint,
          ttlMs: Math.max(3000 - responseTime, 1000),
        };
      } catch (error) {
        console.error('❌ Error generating bid:', error);
        return null;
      }
    });
  }
}

// Start the solver
const solver = new ReferenceSolver();
solver.start().catch(console.error);
```

## Testing

### Unit Tests

```typescript
// solver.test.ts
import { SolverSDK } from '@intendly/solver-sdk';
import { mockIntent, mockConfig } from './test-utils';

describe('SolverSDK', () => {
  let sdk: SolverSDK;

  beforeEach(() => {
    sdk = new SolverSDK(mockConfig);
  });

  afterEach(() => {
    sdk.disconnect();
  });

  it('should subscribe to intents', async () => {
    const handler = jest.fn();
    sdk.subscribeToIntents(handler);
    
    // Simulate intent broadcast
    await simulateIntent(mockIntent);
    
    expect(handler).toHaveBeenCalledWith(mockIntent);
  });

  it('should validate bids correctly', () => {
    const validBid = {
      quoteOut: '1000000000000000000',
      solverFeeBps: 10,
      calldataHint: '0x...',
      ttlMs: 3000,
    };
    
    expect(sdk.validateBid(validBid)).toBe(true);
  });
});
```

### Integration Tests

```typescript
// integration.test.ts
describe('Solver Integration', () => {
  it('should complete full intent flow', async () => {
    // Start test coordinator
    const coordinator = await startTestCoordinator();
    
    // Create solver
    const solver = new SolverSDK(testConfig);
    
    // Subscribe to intents
    solver.subscribeToIntents(async (intent) => ({
      quoteOut: '990000000000000000',
      solverFeeBps: 10,
      calldataHint: '0x123',
      ttlMs: 3000,
    }));
    
    // Submit test intent
    const intent = createTestIntent();
    await coordinator.broadcastIntent(intent);
    
    // Wait for bid
    const bids = await coordinator.waitForBids(intent.hash, 5000);
    expect(bids).toHaveLength(1);
    expect(bids[0].quoteOut).toBe('990000000000000000');
  });
});
```

## Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Start solver
CMD ["npm", "start"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  solver:
    build: .
    environment:
      SOLVER_PRIVATE_KEY: ${SOLVER_PRIVATE_KEY}
      COORDINATOR_URL: ${COORDINATOR_URL}
      WS_URL: ${WS_URL}
      CHAIN_ID: ${CHAIN_ID}
      RPC_URL: ${RPC_URL}
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Production Deployment

```bash
# Build and tag image
docker build -t my-solver:latest .

# Run with production config
docker run -d \
  --name my-solver \
  --env-file .env.production \
  --restart unless-stopped \
  my-solver:latest
```

## Best Practices

### Performance Optimization

1. **Parallel Quote Fetching**: Request quotes from multiple sources simultaneously
2. **Caching**: Cache frequently accessed data (token metadata, pool info)
3. **Connection Pooling**: Reuse HTTP/WebSocket connections
4. **Gas Estimation**: Pre-calculate gas costs for common routes
5. **Error Handling**: Implement graceful degradation for failed quote sources

### Security Considerations

1. **Private Key Management**: Use secure key storage (HSM, encrypted files)
2. **Input Validation**: Validate all intent parameters before processing
3. **Rate Limiting**: Implement internal rate limiting to prevent spam
4. **Monitoring**: Set up alerts for unusual activity or errors
5. **Updates**: Keep dependencies updated and monitor security advisories

### Economic Strategy

1. **Fee Calculation**: Balance competitiveness with profitability
2. **Market Analysis**: Monitor competitor behavior and adjust strategies
3. **Risk Management**: Set position size limits and stop-loss mechanisms
4. **Performance Tracking**: Monitor win rates and adjust parameters

## Troubleshooting

### Common Issues

1. **WebSocket Connection Failures**
   ```typescript
   // Implement reconnection logic
   const connectWithRetry = (url: string, maxRetries = 5) => {
     let retries = 0;
     const connect = () => {
       const ws = new WebSocket(url);
       ws.onclose = () => {
         if (retries < maxRetries) {
           retries++;
           setTimeout(connect, 1000 * retries);
         }
       };
       return ws;
     };
     return connect();
   };
   ```

2. **Quote Source Timeouts**
   ```typescript
   // Add timeout wrapper
   const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
     return Promise.race([
       promise,
       new Promise<T>((_, reject) => 
         setTimeout(() => reject(new Error('Timeout')), ms)
       ),
     ]);
   };
   ```

3. **High Gas Costs**
   ```typescript
   // Optimize gas usage
   const optimizeGas = (quote: Quote) => {
     if (quote.gasEstimate > 500000n) {
       // Skip high-gas quotes
       return null;
     }
     return quote;
   };
   ```

## API Reference

Complete API documentation is available at [docs/sdk-api.md](./docs/sdk-api.md).

---

**Happy solving! 🚀**

*Join our Discord for solver support and community discussions.*